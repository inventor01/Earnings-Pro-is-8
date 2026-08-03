import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Alert, Image, useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Application from 'expo-application';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { submitProblemReport } from '../lib/api';

const REPORT_TYPES = [
  'Bug Report', 'App Crash', 'Performance Issue', 'Incorrect Data',
  'Subscription Issue', 'Login / Account Issue', 'Notification Issue',
  'UI / Display Issue', 'Feature Request', 'Other',
] as const;

const MAX_SCREENSHOTS = 5;
// Keep the description gate tiny — just enough to reject an accidental tap.
// A 20-char minimum made short-but-valid reports like "Crashed" look like a
// broken Submit button.
const MIN_DESC = 3;
const DRAFT_KEY = 'problem-report-draft-v1';

const hTap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
const hOk = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Why the Submit button is blocked, in user words — or null when submittable.
// Exported for tests.
export function submitBlockedReason(s: {
  reportType: string | null;
  description: string;
  email: string;
  isFeatureRequest?: boolean;
}): string | null {
  if (!s.reportType) return 'Please choose what kind of issue this is (the "What kind of issue?" dropdown at the top).';
  if (s.description.trim().length < MIN_DESC) {
    return s.isFeatureRequest
      ? 'Please add a short description of your idea.'
      : 'Please add a short description of what happened.';
  }
  if (!EMAIL_RE.test(s.email.trim())) return 'Please enter a valid contact email so we can follow up.';
  return null;
}

interface Draft {
  reportType: string | null;
  title?: string;
  description: string;
  steps: string;
  email: string;
}

export default function ReportProblemModal({
  visible, onClose, defaultEmail, themeName,
}: {
  visible: boolean;
  onClose: () => void;
  defaultEmail?: string;
  themeName?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [reportType, setReportType] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [shots, setShots] = useState<string[]>([]); // data URLs
  const [includeDiag, setIncludeDiag] = useState(true);
  const [diagOpen, setDiagOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const submittingRef = useRef(false); // sync duplicate-submit guard

  const isFeatureRequest = reportType === 'Feature Request';

  // Diagnostics: device/app facts only — never tokens, credentials, or user
  // content. Screenshots are collected separately with explicit user action.
  const diagnostics = useMemo<Record<string, string>>(() => ({
    app_version: Application.nativeApplicationVersion ?? 'unknown',
    build: Application.nativeBuildVersion ?? 'unknown',
    platform: Platform.OS,
    os_version: String(Platform.Version),
    screen: `${Math.round(width)}×${Math.round(height)}`,
    locale: (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale ?? 'unknown'; } catch { return 'unknown'; } })(),
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown'; } catch { return 'unknown'; } })(),
    theme: themeName ?? 'unknown',
  }), [width, height, themeName]);

  // On open: reset transient state, then restore a draft ONLY if one exists.
  // Drafts are written solely on a failed send (see doSubmit's catch), so a
  // normal close + reopen always shows a fresh form.
  useEffect(() => {
    if (!visible) {
      // Closing without a successful send: start fresh next time. Any
      // failed-send draft lives in AsyncStorage and is restored on reopen.
      resetForm();
      return;
    }
    setSent(false);
    setSubmitting(false);
    submittingRef.current = false;
    setEmail((prev) => prev || defaultEmail || '');
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const d: Draft = JSON.parse(raw);
        // Only restore if the user actually typed something and the form is empty.
        if (d.description || d.steps) {
          setReportType((cur) => cur ?? d.reportType);
          if (d.title) setTitle((cur) => cur || d.title!);
          setDescription((cur) => cur || d.description);
          setSteps((cur) => cur || d.steps);
          if (d.email) setEmail((cur) => cur || d.email);
        }
      } catch {}
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const saveDraft = () => {
    const d: Draft = { reportType, title, description, steps, email };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)).catch(() => {});
  };
  const clearDraft = () => AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
  const resetForm = () => {
    setReportType(null); setTitle(''); setDescription(''); setSteps(''); setShots([]);
    setIncludeDiag(true); setDiagOpen(false); setTypeOpen(false);
    setEmail(defaultEmail ?? '');
  };

  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = !!reportType && description.trim().length >= MIN_DESC && emailOk && !submitting;

  // The Submit button stays tappable even when the form is incomplete — a tap
  // then explains exactly what's missing instead of silently doing nothing.
  const onSubmitPress = () => {
    if (submitting) return;
    const reason = submitBlockedReason({ reportType, description, email, isFeatureRequest });
    if (reason) {
      hTap();
      Alert.alert('Almost there', reason);
      return;
    }
    doSubmit();
  };

  const pickScreenshots = async () => {
    hTap();
    const remaining = MAX_SCREENSHOTS - shots.length;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.4,      // compress client-side — readable, small upload
      base64: true,
    });
    if (res.canceled) return;
    const added: string[] = [];
    let oversized = 0;
    for (const a of res.assets ?? []) {
      if (!a.base64) continue;
      const url = `data:image/jpeg;base64,${a.base64}`;
      if (url.length > 2_600_000) { oversized += 1; continue; } // ~2MB server cap
      added.push(url);
    }
    if (added.length) setShots((prev) => [...prev, ...added].slice(0, MAX_SCREENSHOTS));
    if (oversized > 0) {
      Alert.alert('Image too large', `${oversized} image${oversized === 1 ? ' was' : 's were'} skipped — please use a smaller screenshot.`);
    }
  };

  const doSubmit = async () => {
    if (submittingRef.current || !canSubmit || !reportType) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await submitProblemReport({
        report_type: reportType,
        title: title.trim().slice(0, 200) || undefined,
        description: description.trim(),
        steps: steps.trim() || undefined,
        contact_email: email.trim(),
        diagnostics: includeDiag ? diagnostics : undefined,
        screenshots: shots,
      });
      hOk();
      clearDraft();
      setSent(true);
      AccessibilityInfo.announceForAccessibility('Report sent. Thank you.');
    } catch (e: any) {
      saveDraft(); // never lose typed content
      Alert.alert(
        "Couldn't send report",
        `${e?.message || 'Something went wrong.'} Your report has been saved on this device.`,
        [
          { text: 'Retry', onPress: () => { submittingRef.current = false; setSubmitting(false); doSubmit(); } },
          { text: 'Keep Draft & Close', onPress: () => { submittingRef.current = false; setSubmitting(false); onClose(); } },
          { text: 'Cancel', style: 'cancel', onPress: () => { submittingRef.current = false; setSubmitting(false); } },
        ],
      );
      return;
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  const S = {
    label: { color: t.LABEL, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 8 },
    input: {
      backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12,
      color: t.TEXT, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10,
    },
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.BG }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
          borderBottomWidth: 1, borderBottomColor: t.DIVIDER,
        }}>
          <Text style={{ color: t.TEXT, fontSize: 17, fontWeight: '800' }}>Report a Problem</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={t.MUTED} />
          </Pressable>
        </View>

        {sent ? (
          /* ── Success screen ── */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(34,197,94,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark" size={40} color={t.GREEN} />
            </View>
            <Text style={{ color: t.TEXT, fontSize: 20, fontWeight: '900' }}>Report Sent</Text>
            <Text style={{ color: t.MUTED, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              Thank you for helping improve Earnings Ninja.{'\n\n'}
              Our team has received your report and will investigate it. If we need more
              information, we'll contact you at the email you provided.
            </Text>
            <Pressable
              onPress={() => { hTap(); resetForm(); onClose(); }}
              accessibilityRole="button"
              style={{
                marginTop: 10, minHeight: 48, paddingHorizontal: 40, borderRadius: 12,
                backgroundColor: t.PRIMARY, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: t.ON_PRIMARY, fontSize: 15, fontWeight: '900' }}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
            >
              <Text style={{ color: t.MUTED, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
                Found a bug or something that doesn't seem right? Let us know and we'll investigate.
              </Text>

              {/* Report type */}
              <Text style={S.label}>What kind of issue?</Text>
              <Pressable
                onPress={() => { hTap(); setTypeOpen((o) => !o); }}
                accessibilityRole="button"
                accessibilityLabel={reportType ? `Report type: ${reportType}` : 'Choose a report type'}
                style={[S.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, marginBottom: typeOpen ? 6 : 16 }]}
              >
                <Text style={{ color: reportType ? t.TEXT : t.MUTED, fontSize: 15 }}>
                  {reportType ?? 'Select a type…'}
                </Text>
                <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={t.MUTED} />
              </Pressable>
              {typeOpen && (
                <View style={{
                  backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER,
                  borderRadius: 12, marginBottom: 16, overflow: 'hidden',
                }}>
                  {REPORT_TYPES.map((rt, i) => (
                    <Pressable
                      key={rt}
                      onPress={() => { hTap(); setReportType(rt); setTypeOpen(false); }}
                      accessibilityRole="button"
                      style={{
                        minHeight: 44, paddingHorizontal: 12, justifyContent: 'center',
                        borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.DIVIDER,
                        backgroundColor: reportType === rt ? t.PRI_LITE : 'transparent',
                      }}
                    >
                      <Text style={{ color: reportType === rt ? t.PRIMARY_TXT : t.TEXT, fontSize: 14, fontWeight: reportType === rt ? '800' : '500' }}>
                        {rt}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Title (optional) — becomes the support-email subject */}
              <Text style={S.label}>Title (optional)</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                placeholder={isFeatureRequest ? 'One-line summary of your idea' : 'One-line summary of the issue'}
                placeholderTextColor={t.MUTED}
                style={[S.input, { marginBottom: 16 }]}
                accessibilityLabel="Issue title"
              />

              {/* Description */}
              <Text style={S.label}>{isFeatureRequest ? 'What would you like to see added?' : 'What happened?'}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={isFeatureRequest
                  ? 'What would you like to see added to Earnings Ninja? How would this feature help you?'
                  : "Describe what happened, what you expected to happen, and any steps we can use to reproduce the issue."}
                placeholderTextColor={t.MUTED}
                style={[S.input, { minHeight: 110, textAlignVertical: 'top' }]}
                accessibilityLabel="Problem description"
              />
              <Text style={{
                color: description.trim().length >= MIN_DESC ? t.MUTED : t.LABEL,
                fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16,
              }}>
                {description.trim().length < MIN_DESC
                  ? `${MIN_DESC - description.trim().length} more characters needed`
                  : `${description.trim().length} characters`}
              </Text>

              {/* Steps (hidden for feature requests) */}
              {!isFeatureRequest && (
                <>
                  <Text style={S.label}>Steps to reproduce (optional)</Text>
                  <TextInput
                    value={steps}
                    onChangeText={setSteps}
                    multiline
                    placeholder={'1. Open…\n2. Tap…\n3. Observe…'}
                    placeholderTextColor={t.MUTED}
                    style={[S.input, { minHeight: 80, textAlignVertical: 'top', marginBottom: 16 }]}
                    accessibilityLabel="Steps to reproduce"
                  />
                </>
              )}

              {/* Screenshots */}
              <Text style={S.label}>Screenshots (optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {shots.map((s, i) => (
                  <View key={i} style={{ width: 72, height: 72 }}>
                    <Image source={{ uri: s }} style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: t.BORDER }} />
                    <Pressable
                      onPress={() => { hTap(); setShots((prev) => prev.filter((_, j) => j !== i)); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove screenshot ${i + 1}`}
                      hitSlop={8}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
                        backgroundColor: t.RED, alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {shots.length < MAX_SCREENSHOTS && (
                  <Pressable
                    onPress={pickScreenshots}
                    accessibilityRole="button"
                    accessibilityLabel="Add screenshot"
                    style={{
                      width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
                      borderColor: t.BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: t.SURFACE,
                    }}
                  >
                    <Ionicons name="add" size={26} color={t.MUTED} />
                  </Pressable>
                )}
              </View>

              {/* Contact email */}
              <Text style={S.label}>Contact email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={t.MUTED}
                style={[S.input, { minHeight: 46, borderColor: email && !emailOk ? t.RED : t.BORDER }]}
                accessibilityLabel="Contact email"
              />
              {!!email && !emailOk && (
                <Text style={{ color: t.RED, fontSize: 11, marginTop: 4 }}>Please enter a valid email address.</Text>
              )}

              {/* Diagnostics consent */}
              <Pressable
                onPress={() => { hTap(); setIncludeDiag((v) => !v); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: includeDiag }}
                accessibilityLabel="Include diagnostic information"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, minHeight: 44 }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: includeDiag ? t.PRIMARY : t.BORDER,
                  backgroundColor: includeDiag ? t.PRIMARY : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {includeDiag && <Ionicons name="checkmark" size={14} color={t.ON_PRIMARY} />}
                </View>
                <Text style={{ color: t.TEXT, fontSize: 14, fontWeight: '600', flex: 1 }}>
                  Include diagnostic information
                </Text>
                <Pressable onPress={() => { hTap(); setDiagOpen((o) => !o); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Show diagnostic details">
                  <Text style={{ color: t.PRIMARY_TXT, fontSize: 12, fontWeight: '700' }}>{diagOpen ? 'Hide' : 'Preview'}</Text>
                </Pressable>
              </Pressable>
              <Text style={{ color: t.MUTED, fontSize: 11, marginTop: 2, marginBottom: diagOpen ? 8 : 0 }}>
                Device and app details that help us troubleshoot. Never includes passwords, payment info, or your earnings data.
              </Text>
              {diagOpen && (
                <View style={{ backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12, padding: 12, marginTop: 4 }}>
                  {Object.entries(diagnostics).map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                      <Text style={{ color: t.MUTED, fontSize: 12 }}>{k.replace(/_/g, ' ')}</Text>
                      <Text style={{ color: t.TEXT, fontSize: 12, fontWeight: '600' }}>{v}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Submit */}
              <Pressable
                onPress={onSubmitPress}
                accessibilityRole="button"
                accessibilityLabel="Submit report"
                // Only truly non-actionable while a send is in flight. When the
                // form is incomplete the button stays actionable — activating it
                // announces exactly what's missing — so it must NOT be exposed
                // as disabled to assistive tech.
                accessibilityState={{ disabled: submitting, busy: submitting }}
                accessibilityHint={canSubmit ? undefined : 'Activates to hear what information is still needed'}
                style={({ pressed }) => ({
                  marginTop: 24, minHeight: 52, borderRadius: 14,
                  backgroundColor: canSubmit ? t.PRIMARY : t.BORDER,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                {submitting ? (
                  <ActivityIndicator color={t.ON_PRIMARY} />
                ) : (
                  <Text style={{ color: canSubmit ? t.ON_PRIMARY : t.MUTED, fontSize: 16, fontWeight: '900' }}>
                    Submit Report
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}
