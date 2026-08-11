/**
 * Screenshot Studio — dev-only, web-only marketing screenshot composer.
 *
 * Renders the REAL app (live, interactive) inside store-ready compositions:
 * the device area is an <iframe> of this same Expo web bundle with ?ssdemo=1,
 * which auto-enters the client-side demo sandbox (seeded sample data, zero
 * backend writes). Navigate inside the frame to any screen, style the
 * headline/background around it, then capture at exact store dimensions.
 *
 * Access:  http://localhost:8081/screenshot-studio  (expo web dev server)
 * Gating:  returns a redirect on native or in production builds (__DEV__ only).
 * Export:  toggle "Capture mode (100%)" so the canvas renders at the exact
 *          export pixel size, then screenshot the canvas region (the browser
 *          devtools "Capture node screenshot" on the canvas element gives a
 *          pixel-perfect PNG).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';

// ——— Brand tokens (match the app UI / existing store screenshots) ———
const BRAND_YELLOW = '#FACC15';
const DARK_NAVY = '#0a0a12';
const INK = '#0f0f0f';

interface Scene {
  name: string;
  line1: string;
  line2: string;
  highlight2: boolean;
  fontSize: number;
  align: 'left' | 'center';
  topPad: number;
  bg: string;
  device: string;
  landscape: boolean;
  scale: number;   // device scale within canvas (1 = fit)
  dx: number;      // device x offset (export px)
  dy: number;      // device y offset (export px)
  frame: boolean;
  shadow: boolean;
  note?: string;   // which screen to navigate to inside the live frame
}

// Logical CSS-px viewports (what the app actually lays out at) + export sizes.
const DEVICES: Record<string, { label: string; vw: number; vh: number; exW: number; exH: number }> = {
  phoneSmall: { label: 'Small phone',   vw: 320, vh: 640,  exW: 1080, exH: 1920 },
  phone:      { label: 'Phone',         vw: 390, vh: 844,  exW: 1080, exH: 1920 },
  phoneLarge: { label: 'Large phone',   vw: 430, vh: 932,  exW: 1080, exH: 1920 },
  tablet7:    { label: '7" tablet',     vw: 600, vh: 960,  exW: 1080, exH: 1920 },
  tablet10:   { label: '10" tablet',    vw: 800, vh: 1280, exW: 1920, exH: 1080 },
};

const BASE: Omit<Scene, 'name' | 'line1' | 'line2' | 'note'> = {
  highlight2: false, fontSize: 84, align: 'center', topPad: 70,
  bg: BRAND_YELLOW, device: 'phone', landscape: false,
  scale: 1, dx: 0, dy: 0, frame: true, shadow: true,
};

const PRESETS: Scene[] = [
  { ...BASE, name: '1 · Real profit',   line1: 'Your real profit,',    line2: 'not just gross pay',      note: 'Dashboard · Last 7 Days' },
  { ...BASE, name: '2 · Top gig apps',  line1: 'See which gig apps',   line2: 'pay you the most',        note: 'Analytics · Top Platforms' },
  { ...BASE, name: '3 · Day by day',    line1: 'Track earnings',       line2: 'day by day',              note: 'Calendar (header calendar icon)' },
  { ...BASE, name: '4 · Peak hours',    line1: 'Spot your',            line2: 'peak earning hours',      note: 'Analytics · Peak Hour + By Hour' },
  { ...BASE, name: '5 · Daily glance',  line1: "Every day's profit",   line2: 'at a glance',             note: 'Analytics · Daily Breakdown' },
  { ...BASE, name: '6 · Your data',     line1: 'Your data, your way',  line2: 'export to CSV anytime',   note: 'Settings · Import/Export' },
];

const STORAGE_KEY = 'screenshot-studio-scenes-v1';

// Small styled helpers (control panel chrome) ------------------------------
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 }}>{children}</Text>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}
function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: active ? BRAND_YELLOW : '#26262e', borderWidth: 1, borderColor: active ? BRAND_YELLOW : '#3a3a44' }}>
      <Text style={{ color: active ? '#111' : '#e5e7eb', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Chip label="−" onPress={() => onChange(Math.round((value - step) * 100) / 100)} />
      <Text style={{ color: '#e5e7eb', fontSize: 12, minWidth: 44, textAlign: 'center' }}>{value}</Text>
      <Chip label="+" onPress={() => onChange(Math.round((value + step) * 100) / 100)} />
    </View>
  );
}
const inputStyle = { backgroundColor: '#1c1c22', color: '#f3f4f6', borderRadius: 8, borderWidth: 1, borderColor: '#3a3a44', paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 } as const;

export default function ScreenshotStudio() {
  if (!__DEV__ || Platform.OS !== 'web') return <Redirect href="/" />;
  return <StudioWeb />;
}

function StudioWeb() {
  const [scene, setScene] = useState<Scene>({ ...PRESETS[0] });
  const [captureMode, setCaptureMode] = useState(false);
  const [saved, setSaved] = useState<Scene[]>([]);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    try { const raw = window.localStorage.getItem(STORAGE_KEY); if (raw) setSaved(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  const persist = (scenes: Scene[]) => {
    setSaved(scenes);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes)); } catch { /* ignore */ }
  };
  const set = (patch: Partial<Scene>) => setScene(s => ({ ...s, ...patch }));

  const dev = DEVICES[scene.device] ?? DEVICES.phone;
  const landscape = scene.landscape;
  const vw = landscape ? dev.vh : dev.vw;
  const vh = landscape ? dev.vw : dev.vh;
  const exW = landscape ? Math.max(dev.exW, dev.exH) : Math.min(dev.exW, dev.exH);
  const exH = landscape ? Math.min(dev.exW, dev.exH) : Math.max(dev.exW, dev.exH);

  // Layout math (all in export-pixel space, then the whole canvas is scaled).
  const headlineBlock = scene.topPad + scene.fontSize * 2.4;
  const bezel = scene.frame ? Math.round(exW * 0.016) : 0;
  const fitScale = Math.min((exW * 0.86) / vw, (exH - headlineBlock - exH * 0.06) / vh) * scene.scale;
  const devW = vw * fitScale + bezel * 2;
  const devH = vh * fitScale + bezel * 2;
  const devX = (exW - devW) / 2 + scene.dx;
  const devY = headlineBlock + Math.max(0, (exH - headlineBlock - exH * 0.04 - devH) / 2) + scene.dy;

  const previewScale = captureMode ? 1 : Math.min(720 / exH, 900 / exW);
  const onYellow = scene.bg.toLowerCase() === BRAND_YELLOW.toLowerCase();
  const line1Color = onYellow ? INK : '#ffffff';
  const line2Color = scene.highlight2 ? (onYellow ? '#111111' : BRAND_YELLOW) : line1Color;

  // NOTE: the scale transform lives on a WRAPPER div, never on the iframe
  // itself — Chrome refuses to composite a transformed iframe under a
  // mismatched color-scheme and paints it opaque black. The iframe also pins
  // colorScheme:'light' to match the app's default scheme for the same reason.
  const iframe = useMemo(() => React.createElement('div', {
    style: { width: vw, height: vh, transform: `scale(${fitScale})`, transformOrigin: 'top left' },
    key: `${vw}x${vh}`, // fresh demo session when the viewport changes
  }, React.createElement('iframe', {
    src: '/?ssdemo=1',
    style: { width: vw, height: vh, border: 'none', background: '#000', display: 'block', colorScheme: 'light' },
  })), [vw, vh, fitScale]);

  const canvas = React.createElement('div', {
    id: 'ss-canvas',
    style: {
      width: exW, height: exH, background: scene.bg, position: 'relative', overflow: 'hidden',
      transform: `scale(${previewScale})`, transformOrigin: 'top left', flexShrink: 0,
      // Light color-scheme on the whole canvas subtree — Chrome composits an
      // opaque black canvas for iframes under a mismatched (dark) scheme.
      colorScheme: 'light',
    },
  },
    React.createElement('div', {
      style: {
        position: 'absolute', top: scene.topPad, left: 0, right: 0,
        textAlign: scene.align, padding: '0 60px',
        fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 800,
        fontSize: scene.fontSize, lineHeight: 1.18, whiteSpace: 'pre-wrap',
      },
    },
      React.createElement('div', { style: { color: line1Color } }, scene.line1),
      React.createElement('div', { style: { color: line2Color } }, scene.line2),
    ),
    React.createElement('div', {
      style: {
        position: 'absolute', left: devX, top: devY, width: devW, height: devH,
        boxSizing: 'border-box',
        background: scene.frame ? '#17171b' : 'transparent',
        borderRadius: scene.frame ? Math.round(exW * 0.045) : 12,
        padding: bezel, overflow: 'hidden',
        boxShadow: scene.shadow ? '0 40px 90px rgba(0,0,0,0.35)' : 'none',
      },
    },
      React.createElement('div', {
        style: { width: vw * fitScale, height: vh * fitScale, overflow: 'hidden', borderRadius: scene.frame ? Math.round(exW * 0.03) : 8 },
      }, iframe),
    ),
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#101014', minHeight: '100%' as never }}>
      {/* ——— Control panel ——— */}
      <ScrollView style={{ width: 340, maxWidth: 340, backgroundColor: '#141419', borderRightWidth: 1, borderRightColor: '#26262e' }} contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Screenshot Studio</Text>
        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Live real-app frame · demo sandbox data · dev only</Text>

        <Label>SCENE PRESETS</Label>
        <Row>{PRESETS.map(p => <Chip key={p.name} label={p.name} active={scene.name === p.name} onPress={() => setScene({ ...p })} />)}</Row>
        {scene.note ? <Text style={{ color: BRAND_YELLOW, fontSize: 11, marginTop: 6 }}>→ In the frame, navigate to: {scene.note}</Text> : null}

        <Label>DEVICE</Label>
        <Row>{Object.entries(DEVICES).map(([k, d]) => <Chip key={k} label={d.label} active={scene.device === k} onPress={() => set({ device: k })} />)}</Row>
        <Row>
          <Chip label="Portrait" active={!scene.landscape} onPress={() => set({ landscape: false })} />
          <Chip label="Landscape" active={scene.landscape} onPress={() => set({ landscape: true })} />
        </Row>
        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Export: {exW}×{exH}px · viewport {vw}×{vh}</Text>

        <Label>HEADLINE</Label>
        <TextInput style={inputStyle} value={scene.line1} onChangeText={t => set({ line1: t })} placeholder="Line 1" placeholderTextColor="#555" />
        <View style={{ height: 6 }} />
        <TextInput style={inputStyle} value={scene.line2} onChangeText={t => set({ line2: t })} placeholder="Line 2" placeholderTextColor="#555" />
        <Row>
          <Chip label={scene.highlight2 ? 'Highlight line 2 ✓' : 'Highlight line 2'} active={scene.highlight2} onPress={() => set({ highlight2: !scene.highlight2 })} />
          <Chip label="Left" active={scene.align === 'left'} onPress={() => set({ align: 'left' })} />
          <Chip label="Center" active={scene.align === 'center'} onPress={() => set({ align: 'center' })} />
        </Row>
        <Label>FONT SIZE / TOP SPACING</Label>
        <Row><Num value={scene.fontSize} onChange={v => set({ fontSize: v })} step={4} /><Num value={scene.topPad} onChange={v => set({ topPad: v })} step={10} /></Row>

        <Label>BACKGROUND</Label>
        <Row>
          <Chip label="Ninja Yellow" active={scene.bg === BRAND_YELLOW} onPress={() => set({ bg: BRAND_YELLOW })} />
          <Chip label="Dark navy" active={scene.bg === DARK_NAVY} onPress={() => set({ bg: DARK_NAVY })} />
        </Row>
        <View style={{ height: 6 }} />
        <TextInput style={inputStyle} value={scene.bg} onChangeText={t => set({ bg: t })} placeholder="#hex" placeholderTextColor="#555" />

        <Label>DEVICE POSITION</Label>
        <Row>
          <Num value={scene.scale} onChange={v => set({ scale: Math.max(0.2, v) })} step={0.05} />
          <Num value={scene.dx} onChange={v => set({ dx: v })} step={20} />
          <Num value={scene.dy} onChange={v => set({ dy: v })} step={20} />
        </Row>
        <Text style={{ color: '#6b7280', fontSize: 10 }}>scale · x offset · y offset</Text>
        <Row>
          <Chip label={scene.frame ? 'Frame ✓' : 'Frame'} active={scene.frame} onPress={() => set({ frame: !scene.frame })} />
          <Chip label={scene.shadow ? 'Shadow ✓' : 'Shadow'} active={scene.shadow} onPress={() => set({ shadow: !scene.shadow })} />
        </Row>

        <Label>SCENES</Label>
        <Row>
          <Chip label="Save scene" onPress={() => persist([...saved.filter(s => s.name !== scene.name), { ...scene }])} />
          <Chip label="Duplicate" onPress={() => setScene({ ...scene, name: `${scene.name} copy` })} />
          <Chip label={showJson ? 'Hide JSON' : 'JSON'} active={showJson} onPress={() => setShowJson(!showJson)} />
        </Row>
        {saved.length > 0 && <Row>{saved.map(s => <Chip key={s.name} label={`▶ ${s.name}`} onPress={() => setScene({ ...s })} />)}</Row>}
        {showJson && (
          <TextInput
            style={[inputStyle, { marginTop: 6, fontSize: 10, height: 140 }]} multiline
            value={JSON.stringify(scene, null, 1)}
            onChangeText={t => { try { setScene(JSON.parse(t)); } catch { /* keep typing */ } }}
          />
        )}

        <Label>EXPORT</Label>
        <Chip label={captureMode ? 'Capture mode (100%) ✓' : 'Capture mode (100%)'} active={captureMode} onPress={() => setCaptureMode(!captureMode)} />
        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 6, lineHeight: 16 }}>
          In capture mode the canvas renders at exactly {exW}×{exH}px. Right-click the canvas → Inspect →
          right-click the “ss-canvas” div → “Capture node screenshot” for a pixel-perfect PNG.
        </Text>
      </ScrollView>

      {/* ——— Canvas preview ——— */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }} horizontal={false}>
        <View style={{ width: exW * previewScale, height: exH * previewScale, overflow: 'hidden' }}>{canvas}</View>
      </ScrollView>
    </View>
  );
}
