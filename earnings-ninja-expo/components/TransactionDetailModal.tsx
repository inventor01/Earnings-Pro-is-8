import React from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, Image, Alert,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { useHiddenMode, MASK } from '@/lib/hiddenMode';
import {
  Entry, APP_LABELS, APP_COLORS, EXPENSE_EMOJIS, parseServerDate,
} from '@/lib/api';

interface Props {
  visible: boolean;
  entry: Entry | null;
  onClose: () => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: number) => void;
}

export function TransactionDetailModal({ visible, entry, onClose, onEdit, onDelete }: Props) {
  const {
    TEXT, LABEL, MUTED, RED, GREEN, DIVIDER, PRIMARY, ON_PRIMARY,
    SURFACE, CARD, BORDER,
  } = useTheme();
  const { hidden } = useHiddenMode();

  if (!entry) return null;

  const isExpense = entry.amount < 0;
  const appColor = APP_COLORS[entry.app] || MUTED;
  const d = parseServerDate(entry.timestamp);
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const confirmDelete = () => {
    Alert.alert('Delete Entry', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(160)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 18 }}>
            <Animated.View
              entering={ZoomIn.duration(180).springify().damping(18)}
              style={{
                backgroundColor: SURFACE,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: PRIMARY + '55',
                shadowColor: PRIMARY,
                shadowOpacity: 0.45,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 0 },
                elevation: 14,
                maxHeight: '85%',
                overflow: 'hidden',
              }}
            >
              {/* Stop propagation so taps inside the card don't dismiss.
                  flexShrink: 1 + column layout lets the ScrollView claim every
                  pixel between the fixed header and fixed action bar, so all
                  content (receipt image, notes, etc.) is reachable by scrolling
                  no matter the screen size. */}
              <Pressable onPress={() => {}} style={{ flexShrink: 1, flexDirection: 'column' }}>
                {/* Header */}
                <View style={{
                  paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14,
                  borderBottomWidth: 1, borderBottomColor: BORDER,
                  flexDirection: 'row', alignItems: 'center',
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: appColor + '22',
                    borderWidth: 1, borderColor: appColor + '66',
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ color: appColor, fontSize: 17, fontWeight: '900' }}>
                      {(APP_LABELS[entry.app] || 'O')[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: TEXT, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                      {APP_LABELS[entry.app]}
                    </Text>
                    <Text style={{ color: LABEL, fontSize: 12, marginTop: 2 }}>
                      {entry.type}{entry.category ? ` · ${EXPENSE_EMOJIS[entry.category] || ''} ${entry.category}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
                    <Ionicons name="close" size={22} color={LABEL} />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 24 }}
                  showsVerticalScrollIndicator
                  bounces
                >
                  {/* Amount */}
                  <View style={{
                    backgroundColor: CARD,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: (isExpense ? RED : GREEN) + '55',
                    paddingVertical: 18,
                    alignItems: 'center',
                    shadowColor: isExpense ? RED : GREEN,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                  }}>
                    <Text style={{ color: LABEL, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>
                      AMOUNT
                    </Text>
                    <Text style={{
                      color: isExpense ? RED : GREEN,
                      fontSize: 36, fontWeight: '900', marginTop: 4,
                    }}>
                      {hidden ? MASK : `${isExpense ? '−' : '+'}$${Math.abs(Number(entry.amount)).toFixed(2)}`}
                    </Text>
                  </View>

                  {/* Stat grid */}
                  <DetailRow label="Date"     value={dateStr}                           TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  <DetailRow label="Time"     value={timeStr}                           TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  <DetailRow label="Platform" value={APP_LABELS[entry.app] || entry.app} TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  <DetailRow label="Type"     value={entry.type}                         TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  {Number(entry.distance_miles) > 0 && (
                    <DetailRow label="Miles" value={`${Number(entry.distance_miles).toFixed(2)} mi`} TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  )}
                  {Number(entry.duration_minutes) > 0 && (
                    <DetailRow label="Minutes" value={`${entry.duration_minutes} min`} TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  )}
                  {entry.order_id ? (
                    <DetailRow label="Order ID" value={entry.order_id} TEXT={TEXT} LABEL={LABEL} DIVIDER={DIVIDER} />
                  ) : null}

                  {entry.note ? (
                    <View>
                      <Text style={{ color: LABEL, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 }}>
                        NOTES
                      </Text>
                      <View style={{
                        backgroundColor: CARD, borderRadius: 12,
                        borderWidth: 1, borderColor: BORDER, padding: 12,
                      }}>
                        <Text style={{ color: TEXT, fontSize: 14, lineHeight: 20 }}>
                          {entry.note}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {entry.receipt_url ? (
                    <View>
                      <Text style={{ color: LABEL, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 }}>
                        RECEIPT
                      </Text>
                      <View style={{
                        borderRadius: 12, overflow: 'hidden',
                        borderWidth: 1, borderColor: BORDER,
                        backgroundColor: CARD,
                      }}>
                        <Image
                          source={{ uri: entry.receipt_url }}
                          style={{ width: '100%', height: 220 }}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {/* Actions */}
                <View style={{
                  flexDirection: 'row', gap: 10,
                  padding: 14,
                  borderTopWidth: 1, borderTopColor: BORDER,
                }}>
                  <Pressable
                    onPress={confirmDelete}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: RED + '15',
                      borderWidth: 1, borderColor: RED + '88',
                      borderRadius: 12,
                      paddingVertical: 14,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Ionicons name="trash-outline" size={18} color={RED} />
                    <Text style={{ color: RED, fontSize: 15, fontWeight: '700' }}>Delete</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onEdit(entry)}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: PRIMARY,
                      borderRadius: 12,
                      paddingVertical: 14,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      shadowColor: PRIMARY,
                      shadowOpacity: 0.55,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 0 },
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Ionicons name="pencil" size={18} color={ON_PRIMARY} />
                    <Text style={{ color: ON_PRIMARY, fontSize: 15, fontWeight: '800' }}>Edit</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function DetailRow({
  label, value, TEXT, LABEL, DIVIDER,
}: { label: string; value: string; TEXT: string; LABEL: string; DIVIDER: string }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DIVIDER,
    }}>
      <Text style={{ color: LABEL, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700', maxWidth: '65%' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
