import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useTheme } from '@/hooks/useColors';
import { RevealType, RoutineType, TriggerMethod, useMagic } from '@/context/MagicContext';

type Operator = '+' | '-' | '×' | '÷' | null;
type ToolPanel = 'history' | 'scientific' | 'currency' | null;
type CalculationRecord = { expression: string; result: string; id: string };

const revealLabels: Record<RevealType, string> = { number: 'Number', text: 'Text', emoji: 'Emoji', prediction: 'Prediction' };
const triggerLabels: Record<TriggerMethod, string> = { equals: '[=] Press — multiple times', operations: 'Operation count', manual: 'Manual reveal' };
const routineLabels: Record<RoutineType, string> = { standard: 'Standard routine', 'audience-number': 'Random audience number' };

function calculate(a: number, b: number, op: Operator) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b === 0 ? NaN : a / b;
  return b;
}

function evaluateExpression(expression: string) {
  const tokens = expression.replace(/−/g, '-').match(/(?:\d+\.?\d*|\.\d+|[()+\-×÷])/g) ?? [];
  const values: number[] = [];
  const operators: Array<Operator | '('> = [];
  const applyTop = () => {
    const op = operators.pop();
    if (!op || op === '(') return;
    const right = values.pop() ?? 0;
    const left = values.pop() ?? 0;
    values.push(calculate(left, right, op));
  };
  const precedence = (op: Operator | '(') => op === '×' || op === '÷' ? 2 : 1;
  tokens.forEach((token, index) => {
    if (!token) return;
    if (/^\d|\./.test(token)) {
      values.push(Number(token));
    } else if ((token === '+' || token === '-') && (index === 0 || tokens[index - 1] === '(' || /[+\-×÷]/.test(tokens[index - 1] ?? '')) && /^\d|\./.test(tokens[index + 1] ?? '')) {
      values.push(Number(`${token === '-' ? '-' : ''}${tokens[index + 1]}`));
      tokens[index + 1] = '';
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') applyTop();
      if (operators[operators.length - 1] === '(') operators.pop();
    } else {
      const op = token as Operator;
      while (operators.length && operators[operators.length - 1] !== '(' && precedence(operators[operators.length - 1]) >= precedence(op)) applyTop();
      operators.push(op);
    }
  });
  while (operators.length) {
    if (operators[operators.length - 1] === '(') operators.pop();
    else applyTop();
  }
  return values[0] ?? 0;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return 'Error';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
}

function replaceFinalOperand(expression: string, operand: number) {
  const match = expression.match(/(\d*\.?\d+)$/);
  if (!match || match.index === undefined) return expression;
  return `${expression.slice(0, match.index)}${formatNumber(operand)}`;
}

function getNextBracket(expression: string): '(' | ')' {
  const openCount = (expression.match(/\(/g) ?? []).length;
  const closeCount = (expression.match(/\)/g) ?? []).length;
  const endsWithOperatorOrOpen = /[+\-×÷(]$/.test(expression);

  // Close the innermost open group whenever the current value can be closed.
  // Otherwise start a new group, allowing expressions such as:
  // (8×9)+(56+96)+(89+9)
  if (openCount > closeCount && !endsWithOperatorOrOpen) return ')';
  return '(';
}

function Key({ label, tone = 'number', onPress, icon, testID }: { label: string; tone?: 'number' | 'utility' | 'operator' | 'equals'; onPress: () => void; icon?: React.ReactNode; testID?: string }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const buttonSize = Math.min(84, Math.max(68, (width - 64) / 4));
  const bg = tone === 'equals' ? colors.primary : tone === 'utility' || tone === 'operator' ? colors.secondary : colors.numberButton;
  const fg = tone === 'equals' ? colors.primaryForeground : tone === 'utility' || tone === 'operator' ? colors.primary : colors.foreground;
  return <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable testID={testID} onPressIn={() => Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, speed: 30 }).start()} onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()} onPress={() => { Haptics.selectionAsync(); onPress(); }} style={[styles.key, { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, backgroundColor: bg, shadowColor: colors.foreground }]}>
      {icon ?? <Text style={[styles.keyText, { color: fg }]}>{label}</Text>}
    </Pressable>
  </Animated.View>;
}

function MagicSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { config, history, saveConfig, clearMagic } = useMagic();
  const [routineType, setRoutineType] = useState<RoutineType>(config?.routineType ?? 'standard');
  const [revealType, setRevealType] = useState<RevealType>(config?.revealType ?? 'number');
  const [secret, setSecret] = useState(config?.secret ?? '');
  const [triggerOperator, setTriggerOperator] = useState<'+' | '-'>(config?.triggerOperator ?? '+');
  const [triggerMethod, setTriggerMethod] = useState<TriggerMethod>(config?.triggerMethod ?? 'equals');
  const [triggerCount, setTriggerCount] = useState(String(config?.triggerCount ?? 5));
  const [audienceMultipleEquals, setAudienceMultipleEquals] = useState((config?.triggerCount ?? 1) > 1);
  const [oneTimeOnly, setOneTimeOnly] = useState(config?.oneTimeOnly ?? true);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setRevealType(config?.revealType ?? 'number'); setSecret(config?.secret ?? ''); setTriggerMethod(config?.triggerMethod ?? 'equals');
    setRoutineType(config?.routineType ?? 'standard'); setTriggerOperator(config?.triggerOperator ?? '+');
    setTriggerCount(String(config?.triggerCount ?? 5)); setAudienceMultipleEquals((config?.triggerCount ?? 1) > 1); setOneTimeOnly(config?.oneTimeOnly ?? true); setError('');
  }, [visible, config]);

  const cycle = <T,>(value: T, options: T[], setter: (next: T) => void) => setter(options[(options.indexOf(value) + 1) % options.length]);
  const save = async () => {
    const count = Number(triggerCount);
    if (!secret.trim()) return setError('Add a secret to activate this routine.');
    if (!Number.isInteger(count) || count < 1) return setError('Trigger count must be a positive whole number.');
    if (routineType === 'audience-number') {
      const finalResult = Number(secret);
      if (!Number.isFinite(finalResult)) return setError('Audience number routines need a numeric final result.');
      const audienceCount = audienceMultipleEquals ? count : 1;
      await saveConfig({ routineType, revealType, secret: secret.trim(), secretTarget: secret.trim(), triggerOperator, triggerMethod: 'equals', triggerCount: audienceCount, oneTimeOnly });
    } else {
      await saveConfig({ routineType, revealType, secret: secret.trim(), triggerMethod, triggerCount: count, oneTimeOnly });
    }
    onClose();
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, shadowColor: colors.foreground }]}>
         <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
         <View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>PRIVATE ROUTINE</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Magic Set</Text></View><Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.secondary }]}><Ionicons name="close" size={22} color={colors.mutedForeground} /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Routine</Text>
          <Pressable onPress={() => cycle(routineType, ['standard', 'audience-number'], setRoutineType)} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={[styles.selectText, { color: colors.foreground }]}>{routineLabels[routineType]}</Text><Feather name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable>
           {routineType === 'standard' && <><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Reveal type</Text>
           <Pressable onPress={() => cycle(revealType, ['number', 'text', 'emoji', 'prediction'], setRevealType)} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={[styles.selectText, { color: colors.foreground }]}>{revealLabels[revealType]}</Text><Feather name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable></>}
           <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{routineType === 'audience-number' ? 'Secret target' : 'Secret'}</Text>
           <TextInput value={secret} onChangeText={setSecret} placeholder={routineType === 'audience-number' ? '9000' : 'Enter your secret...'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: error ? colors.destructive : colors.border, color: colors.foreground, backgroundColor: colors.secondary }]} autoCapitalize="none" keyboardType={routineType === 'audience-number' ? 'decimal-pad' : 'default'} />
           {routineType === 'audience-number' && <><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Trigger operator</Text><Pressable onPress={() => setTriggerOperator((value) => value === '+' ? '-' : '+')} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={[styles.selectText, { color: colors.foreground }]}>{triggerOperator === '+' ? '+' : '−'}</Text><Feather name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable><Text style={[styles.advancedCaption, { color: colors.mutedForeground, marginTop: 10 }]}>Let the audience enter any number. When they press =, the calculator secretly adjusts that number so your chosen target appears.</Text></>}
           {routineType === 'audience-number' && <><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Reveal trigger</Text><Pressable onPress={() => setAudienceMultipleEquals((value) => !value)} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={[styles.selectText, { color: colors.foreground }]}>{audienceMultipleEquals ? 'Press = multiple times' : 'Press = once'}</Text><Feather name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable>{audienceMultipleEquals && <><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How many times to press "="?</Text><TextInput value={triggerCount} onChangeText={(value) => setTriggerCount(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[styles.input, { borderColor: error ? colors.destructive : colors.border, color: colors.foreground, backgroundColor: colors.secondary }]} /></>}<Text style={[styles.advancedCaption, { color: colors.mutedForeground, marginTop: 10 }]}>Secret result appears on the selected "=" press.</Text></>}
          {routineType === 'standard' && <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Trigger method</Text>}
          {routineType === 'standard' && <Pressable onPress={() => cycle(triggerMethod, ['equals', 'operations', 'manual'], setTriggerMethod)} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.secondary }]}><Text style={[styles.selectText, { color: colors.foreground }]}>{triggerLabels[triggerMethod]}</Text><Feather name="chevron-down" size={18} color={colors.mutedForeground} /></Pressable>}
          {routineType === 'standard' && triggerMethod !== 'manual' && <><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How many times to press [=] to reveal?</Text><TextInput value={triggerCount} onChangeText={(value) => setTriggerCount(value.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]} /><View style={[styles.helper, { backgroundColor: colors.accent }]}><MaterialCommunityIcons name="target" size={18} color={colors.primary} /><Text style={[styles.helperText, { color: colors.accentForeground }]}>Complete {triggerCount || '0'} calculations → reveal: {secret || 'your secret'}</Text></View></>}
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <View style={[styles.toggleRow, { borderColor: colors.border }]}><View><Text style={[styles.toggleTitle, { color: colors.foreground }]}>One time only</Text><Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Disable after the reveal</Text></View><Switch value={oneTimeOnly} onValueChange={setOneTimeOnly} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} /></View>
          <Pressable onPress={() => setAdvanced((value) => !value)} style={styles.advancedRow}><Text style={[styles.advancedText, { color: colors.foreground }]}>Advanced mode</Text><Feather name={advanced ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} /></Pressable>
          {advanced && <View style={[styles.advancedPanel, { backgroundColor: colors.secondary }]}><Text style={[styles.advancedCaption, { color: colors.mutedForeground }]}>History keeps the routine type, trigger count, and status — never the secret.</Text><Text style={[styles.advancedCaption, { color: colors.mutedForeground }]}>{history.length} routine record{history.length === 1 ? '' : 's'} saved locally.</Text>{config?.enabled && <Pressable onPress={async () => { await clearMagic(); onClose(); }}><Text style={[styles.disableText, { color: colors.destructive }]}>Disable magic routine</Text></Pressable>}</View>}
          <View style={styles.sheetActions}><Pressable onPress={onClose} style={[styles.cancelButton, { borderColor: colors.border }]}><Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text></Pressable><Pressable onPress={save} style={[styles.activateButton, { backgroundColor: colors.primary }]}><Text style={styles.activateText}>Save / Activate</Text></Pressable></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

export default function CalculatorScreen() {
  const colors = useColors();
  const { theme, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { config, isLoaded, countOperation, finishReveal, resetCounter } = useMagic();
  const [display, setDisplay] = useState('0');
  const [hasResult, setHasResult] = useState(false);
  const [lastExpression, setLastExpression] = useState('');
  const [showMagic, setShowMagic] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [audienceBaseResult, setAudienceBaseResult] = useState<number | null>(null);
  const [audienceEqualsPresses, setAudienceEqualsPresses] = useState(0);
  const [audienceInputActive, setAudienceInputActive] = useState(false);
  const [toolPanel, setToolPanel] = useState<ToolPanel>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [calculationHistory, setCalculationHistory] = useState<CalculationRecord[]>([]);
  const [currencyAmount, setCurrencyAmount] = useState('1');
  const [currencyFrom, setCurrencyFrom] = useState('USD');
  const [currencyTo, setCurrencyTo] = useState('INR');
  const [liveRates, setLiveRates] = useState<Record<string, number>>({ USD: 1, EUR: 0.92, GBP: 0.78, INR: 83.5, JPY: 150.2 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState('');
  const percentTaps = useRef<number[]>([]);
  const revealScale = useRef(new Animated.Value(1)).current;
  const displayScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('@magical-calculator/sound'), AsyncStorage.getItem('@magical-calculator/calculations')])
      .then(([storedSound, storedHistory]) => {
        if (storedSound !== null) setSoundEnabled(storedSound === 'true');
        if (storedHistory) setCalculationHistory(JSON.parse(storedHistory));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (toolPanel !== 'currency') return;
    setRatesLoading(true);
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((response) => response.json())
      .then((data) => {
        if (data?.result === 'success' && data.rates) {
          setLiveRates({ USD: 1, EUR: data.rates.EUR, GBP: data.rates.GBP, INR: data.rates.INR, JPY: data.rates.JPY });
          setRatesUpdatedAt(new Date().toLocaleTimeString());
        }
      })
      .catch(() => undefined)
      .finally(() => setRatesLoading(false));
  }, [toolPanel]);

  const saveSoundPreference = (enabled: boolean) => {
    setSoundEnabled(enabled);
    AsyncStorage.setItem('@magical-calculator/sound', String(enabled));
  };

  const addToHistory = (expression: string, result: string) => {
    const next = [{ id: `${Date.now()}`, expression, result }, ...calculationHistory].slice(0, 30);
    setCalculationHistory(next);
    AsyncStorage.setItem('@magical-calculator/calculations', JSON.stringify(next));
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      displayScrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [display, hasResult]);

  const tapPercent = () => {
    const now = Date.now();
    percentTaps.current = [...percentTaps.current.filter((time) => now - time < 760), now];
    if (percentTaps.current.length === 3) { percentTaps.current = []; setShowMagic(true); return; }
    setDisplay((value) => value.replace(/(\d*\.?\d+)$/, (number) => String(Number(number) / 100)));
    setLastExpression('');
    setHasResult(false);
  };
  const handleDigit = (digit: string) => {
    const isStartingAudienceInput = config?.enabled && config.routineType === 'audience-number' && audienceBaseResult !== null && hasResult && !audienceInputActive;
    if (isStartingAudienceInput) {
      const operator = config.triggerOperator === '-' ? '-' : '+';
      setDisplay(`${audienceBaseResult}${operator}${digit}`);
      setAudienceEqualsPresses(0);
      setAudienceInputActive(true);
    } else {
      setDisplay((value) => hasResult || value === '0' ? digit : value === '-' || value === '+' ? value + digit : value + digit);
    }
    setLastExpression('');
    setHasResult(false);
  };
  const handleDecimal = () => {
    const currentNumber = display.split(/[+\-×÷]/).pop() ?? '';
    const isStartingAudienceInput = config?.enabled && config.routineType === 'audience-number' && audienceBaseResult !== null && hasResult && !audienceInputActive;
    if (isStartingAudienceInput) {
      const operator = config.triggerOperator === '-' ? '-' : '+';
      setDisplay(`${audienceBaseResult}${operator}0.`);
      setAudienceEqualsPresses(0);
      setAudienceInputActive(true);
    } else if (hasResult) setDisplay('0.');
    else if (display === '-' || display === '+') setDisplay((value) => `${value}0.`);
    else if (!currentNumber.includes('.')) setDisplay((value) => `${value}.`);
    setLastExpression('');
    setHasResult(false);
  };
  const handleOperator = (nextOperator: Operator) => {
    if (!hasResult && display === '0' && (nextOperator === '+' || nextOperator === '-')) {
      setDisplay(nextOperator);
      setLastExpression('');
      return;
    }
    if (hasResult) {
      const audienceOperator = config?.enabled && config.routineType === 'audience-number' && audienceBaseResult !== null
        ? config.triggerOperator === '-' ? '-' : '+'
        : nextOperator;
      setDisplay((value) => `${value}${audienceOperator}`);
      if (config?.enabled && config.routineType === 'audience-number' && audienceBaseResult !== null) {
        setAudienceEqualsPresses(0);
        setAudienceInputActive(true);
      }
      setLastExpression('');
      setHasResult(false);
      return;
    }
    setDisplay((value) => /[+\-×÷]$/.test(value) ? `${value.slice(0, -1)}${nextOperator}` : `${value}${nextOperator}`);
    setLastExpression('');
  };
  const handleEquals = async () => {
    if (/[+\-×÷]$/.test(display)) return;
    const expressionBeforeEquals = display;
    const isAudienceRoutine = config?.enabled && config.routineType === 'audience-number';
    const audienceTriggerCount = Math.max(1, Number(config?.triggerCount ?? 1));
    const nextAudienceEquals = audienceEqualsPresses + 1;
    const configuredAudienceOperator = config?.triggerOperator === '-' ? '-' : '+';
    const inlineAudienceOperandIndex = isAudienceRoutine && audienceBaseResult === null && !audienceInputActive
      ? display.lastIndexOf(configuredAudienceOperator)
      : -1;
    const inlineAudienceBaseExpression = inlineAudienceOperandIndex > 0 ? display.slice(0, inlineAudienceOperandIndex) : '';
    const inlineAudienceOperandText = inlineAudienceOperandIndex > 0 ? display.slice(inlineAudienceOperandIndex + 1) : '';
    const inlineAudienceBaseResult = inlineAudienceBaseExpression ? evaluateExpression(inlineAudienceBaseExpression) : NaN;
    const hasInlineAudienceSequence = isAudienceRoutine &&
      inlineAudienceOperandIndex > 0 &&
      inlineAudienceOperandText.length > 0 &&
      Number.isFinite(inlineAudienceBaseResult) &&
      Number.isFinite(Number(inlineAudienceOperandText));
    const audienceSequenceBaseResult = audienceBaseResult ?? (hasInlineAudienceSequence ? inlineAudienceBaseResult : null);
    const isAudienceSequence = isAudienceRoutine && audienceSequenceBaseResult !== null && (audienceInputActive || hasInlineAudienceSequence);
    const isAudienceTrigger = isAudienceSequence && nextAudienceEquals >= audienceTriggerCount;

    // Audience reveal is an exclusive equals path. Do this before evaluating
    // the visible expression so the ordinary result can never be committed.
    if (isAudienceTrigger && config) {
      const secretTargetText = String(config.secretTarget ?? config.secret).trim();
      const target = Number(secretTargetText);
      const currentResult = audienceSequenceBaseResult as number;
      const audienceOperand = Number(display.match(/(?:^|[+\-×÷])(-?\d*\.?\d+)$/)?.[1] ?? NaN);
      const hiddenOperand = config.triggerOperator === '-' ? currentResult - target : target - currentResult;
      const adjustedResult = config.triggerOperator === '-' ? currentResult - hiddenOperand : currentResult + hiddenOperand;
      const adjustedExpression = replaceFinalOperand(display, hiddenOperand);
      if (__DEV__) {
        console.log('[Magic Audience Number]', {
          currentResult,
          audienceOperand,
          hiddenOperand,
          secretTarget: secretTargetText,
          equalPressCount: nextAudienceEquals,
          magicTriggered: true,
          adjustedExpression,
          adjustedResult,
        });
      }
      setLastExpression(adjustedExpression);
      setDisplay(formatNumber(target));
      setHasResult(true);
      setRevealing(true);
      setAudienceEqualsPresses(0);
      setAudienceInputActive(false);
      Animated.sequence([
        Animated.timing(revealScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(revealScale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
      finishReveal().finally(() => setRevealing(false));
      return;
    }

    const result = evaluateExpression(display);
    const shouldReveal = !isAudienceRoutine && config?.enabled && config.triggerMethod !== 'manual' && countOperation();
    if (shouldReveal && config) {
      setLastExpression(expressionBeforeEquals);
      setDisplay(config.secret);
      setHasResult(true);
      setRevealing(true);
      Animated.sequence([
        Animated.timing(revealScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(revealScale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
      finishReveal().finally(() => setRevealing(false));
      return;
    }
    setLastExpression(expressionBeforeEquals);
    setDisplay(formatNumber(result));
    setHasResult(true);
    addToHistory(expressionBeforeEquals, formatNumber(result));
    if (isAudienceSequence) {
      setAudienceBaseResult(audienceSequenceBaseResult);
      setAudienceEqualsPresses(nextAudienceEquals);
      setAudienceInputActive(true);
    } else if (isAudienceRoutine && Number.isFinite(result)) {
      setAudienceBaseResult(result);
      setAudienceEqualsPresses(0);
      setAudienceInputActive(false);
    }
  };
  const clear = () => { setDisplay('0'); setLastExpression(''); setHasResult(false); setAudienceBaseResult(null); setAudienceEqualsPresses(0); setAudienceInputActive(false); resetCounter(); };
  const backspace = () => { setLastExpression(''); setHasResult(false); setDisplay((value) => value.length > 1 ? value.slice(0, -1) : '0'); };
  const toggleSign = () => { setLastExpression(''); setHasResult(false); setDisplay((value) => value.replace(/(\d*\.?\d+)$/, (number) => `${Number(number) * -1}`)); };
  const handleBracket = (bracket: '(' | ')') => {
    setLastExpression('');
    setHasResult(false);
    setDisplay((value) => {
      if (hasResult) return bracket === '(' ? '(' : value;
      if (bracket === '(') {
        if (value === '0') return '(';
        return /[\d)]$/.test(value) ? `${value}×(` : `${value}(`;
      }
      if (value === '0' || /[+\-×÷(]$/.test(value)) return value;
      const opens = (value.match(/\(/g) ?? []).length;
      const closes = (value.match(/\)/g) ?? []).length;
      return opens > closes ? `${value})` : value;
    });
  };
  const showAudienceExpression = config?.routineType === 'audience-number' && lastExpression.length > 0;
  const convertedCurrency = (Number(currencyAmount) || 0) * liveRates[currencyTo] / liveRates[currencyFrom];
  const applyScientific = (operation: string) => {
    const value = Number(display);
    if (!Number.isFinite(value)) return;
    const result = operation === 'sqrt' ? Math.sqrt(value) : operation === 'square' ? value * value : operation === 'cube' ? value ** 3 : operation === 'reciprocal' ? 1 / value : operation === 'sin' ? Math.sin(value * Math.PI / 180) : operation === 'cos' ? Math.cos(value * Math.PI / 180) : operation === 'tan' ? Math.tan(value * Math.PI / 180) : operation === 'sinh' ? Math.sinh(value) : operation === 'cosh' ? Math.cosh(value) : operation === 'tanh' ? Math.tanh(value) : operation === 'ln' ? Math.log(value) : operation === 'log' ? Math.log10(value) : operation === 'exp' ? Math.exp(value) : operation === 'factorial' ? Array.from({ length: Math.max(0, Math.floor(value)) }, (_, index) => index + 1).reduce((total, item) => total * item, 1) : operation === 'pi' ? Math.PI : operation === 'random' ? Math.random() : value;
    setLastExpression(`${operation}(${display})`);
    setDisplay(formatNumber(result));
    setHasResult(true);
    addToHistory(`${operation}(${display})`, formatNumber(result));
    setToolPanel(null);
  };
  if (!isLoaded) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 0), paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 14) }]}>
     <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
     <View style={styles.topBar}>
       <Text style={[styles.appTitle, { color: colors.foreground }]}>Calculator</Text>
       <Pressable accessibilityLabel="Settings" onPress={() => setSettingsVisible(true)} style={styles.iconButton}><Feather name="settings" size={22} color={colors.foreground} /></Pressable>
     </View>
    <View style={styles.displayWrap}>
      <ScrollView ref={displayScrollRef} horizontal showsHorizontalScrollIndicator={false} directionalLockEnabled contentContainerStyle={styles.displayScrollContent} style={styles.displayScroll} scrollEventThrottle={16}>
        {hasResult && showAudienceExpression ? (
          <View style={styles.resultStack}>
            <Text numberOfLines={1} style={[styles.displayExpression, { color: colors.mutedForeground }]}>{lastExpression}</Text>
            <Animated.Text numberOfLines={1} style={[styles.displayResult, { color: revealing ? colors.primary : colors.foreground, transform: [{ scale: revealScale }] }]}>{display}</Animated.Text>
          </View>
        ) : (
          <Animated.Text numberOfLines={1} style={[hasResult ? styles.displayResult : styles.displayExpression, { color: revealing ? colors.primary : colors.foreground, transform: [{ scale: revealScale }] }]}>{display}</Animated.Text>
        )}
      </ScrollView>
    </View>
     <View style={[styles.toolBar, { borderColor: colors.border }]}>
       <Pressable accessibilityLabel="Calculation history" onPress={() => setToolPanel('history')} style={styles.toolButton}><Feather name="clock" size={22} color={colors.foreground} /></Pressable>
       <Pressable accessibilityLabel="Scientific calculator" onPress={() => setToolPanel('scientific')} style={styles.toolButton}><MaterialCommunityIcons name="function-variant" size={23} color={colors.foreground} /></Pressable>
       <Pressable accessibilityLabel="Currency converter" onPress={() => setToolPanel('currency')} style={styles.toolButton}><MaterialCommunityIcons name="currency-usd" size={23} color={colors.foreground} /></Pressable>
     </View>
     <View style={styles.keypad}>
       <View style={styles.row}><Key label="AC" tone="utility" onPress={clear} testID="clear" /><Key label="()" tone="utility" onPress={() => handleBracket(getNextBracket(display))} /><Key label="%" tone="utility" onPress={tapPercent} testID="percent" /><Key label="÷" tone="operator" onPress={() => handleOperator('÷')} /></View>
      <View style={styles.row}><Key label="7" onPress={() => handleDigit('7')} /><Key label="8" onPress={() => handleDigit('8')} /><Key label="9" onPress={() => handleDigit('9')} /><Key label="×" tone="operator" onPress={() => handleOperator('×')} /></View>
      <View style={styles.row}><Key label="4" onPress={() => handleDigit('4')} /><Key label="5" onPress={() => handleDigit('5')} /><Key label="6" onPress={() => handleDigit('6')} /><Key label="−" tone="operator" onPress={() => handleOperator('-')} /></View>
      <View style={styles.row}><Key label="1" onPress={() => handleDigit('1')} /><Key label="2" onPress={() => handleDigit('2')} /><Key label="3" onPress={() => handleDigit('3')} /><Key label="+" tone="operator" onPress={() => handleOperator('+')} /></View>
      <View style={styles.row}><Key label="⌫" tone="utility" onPress={backspace} icon={<Feather name="delete" size={23} color={colors.primary} />} /><Key label="0" onPress={() => handleDigit('0')} /><Key label="." onPress={handleDecimal} /><Key label="=" tone="equals" onPress={handleEquals} testID="equals" /></View>
    </View>
     <Modal visible={toolPanel !== null} animationType="slide" transparent onRequestClose={() => setToolPanel(null)}>
       <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setToolPanel(null)} />
         <View style={[styles.toolSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{toolPanel === 'history' ? 'History' : toolPanel === 'scientific' ? 'Scientific' : 'Currency converter'}</Text><Pressable onPress={() => setToolPanel(null)} style={[styles.closeButton, { backgroundColor: colors.secondary }]}><Ionicons name="close" size={22} color={colors.mutedForeground} /></Pressable></View>
           {toolPanel === 'history' && <ScrollView contentContainerStyle={styles.panelContent}>{calculationHistory.length === 0 ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your calculations will appear here.</Text> : calculationHistory.map((item) => <Pressable key={item.id} onPress={() => { setDisplay(item.result); setHasResult(true); setToolPanel(null); }} style={[styles.historyRow, { borderBottomColor: colors.border }]}><Text style={[styles.historyExpression, { color: colors.mutedForeground }]}>{item.expression}</Text><Text style={[styles.historyResult, { color: colors.foreground }]}>= {item.result}</Text></Pressable>)}{calculationHistory.length > 0 && <Pressable onPress={() => { setCalculationHistory([]); AsyncStorage.removeItem('@magical-calculator/calculations'); }} style={[styles.clearHistoryButton, { borderColor: colors.destructive }]}><Text style={[styles.clearHistoryText, { color: colors.destructive }]}>Clear history</Text></Pressable>}</ScrollView>}
          {toolPanel === 'scientific' && <ScrollView contentContainerStyle={styles.panelContent}><Text style={[styles.panelHint, { color: colors.mutedForeground }]}>Scientific functions use the current display value. Trigonometry uses degrees.</Text><View style={styles.scienceGrid}>{[['2nd', 'second'], ['10ˣ', 'tenPower'], ['1/x', 'reciprocal'], ['x²', 'square'], ['x³', 'cube'], ['xʸ', 'power'], ['x!', 'factorial'], ['√', 'sqrt'], ['ʸ√x', 'root'], ['lg', 'log'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['ln', 'ln'], ['sinh', 'sinh'], ['cosh', 'cosh'], ['tanh', 'tanh'], ['eˣ', 'exp'], ['Rad', 'rad'], ['π', 'pi'], ['EE', 'ee'], ['Rand', 'random']].map(([label, operation]) => <Pressable key={operation} onPress={() => applyScientific(operation)} style={[styles.scienceButton, { backgroundColor: colors.secondary }]}><Text style={[styles.scienceText, { color: colors.foreground }]}>{label}</Text></Pressable>)}</View><View style={styles.memoryRow}>{['mc', 'm+', 'm−', 'mr'].map((label) => <Pressable key={label} style={[styles.memoryButton, { backgroundColor: colors.secondary }]}><Text style={[styles.scienceText, { color: colors.foreground }]}>{label}</Text></Pressable>)}</View></ScrollView>}
           {toolPanel === 'currency' && <View style={styles.panelContent}><Text style={[styles.panelHint, { color: colors.mutedForeground }]}>{ratesLoading ? 'Updating live exchange rates…' : `Live rates${ratesUpdatedAt ? ` · updated ${ratesUpdatedAt}` : ''}`}</Text><TextInput value={currencyAmount} onChangeText={setCurrencyAmount} keyboardType="decimal-pad" style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]} /><View style={styles.currencyRow}>{['USD', 'EUR', 'GBP', 'INR', 'JPY'].map((code) => <Pressable key={code} onPress={() => setCurrencyFrom(code)} style={[styles.currencyChip, { backgroundColor: currencyFrom === code ? colors.primary : colors.secondary }]}><Text style={{ color: currencyFrom === code ? colors.primaryForeground : colors.foreground }}>{code}</Text></Pressable>)}</View><Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Convert to</Text><View style={styles.currencyRow}>{['USD', 'EUR', 'GBP', 'INR', 'JPY'].map((code) => <Pressable key={code} onPress={() => setCurrencyTo(code)} style={[styles.currencyChip, { backgroundColor: currencyTo === code ? colors.primary : colors.secondary }]}><Text style={{ color: currencyTo === code ? colors.primaryForeground : colors.foreground }}>{code}</Text></Pressable>)}</View><Text style={[styles.conversionResult, { color: colors.foreground }]}>{formatNumber(convertedCurrency)} {currencyTo}</Text></View>}
         </View>
       </View>
     </Modal>
     <Modal visible={settingsVisible} animationType="slide" transparent onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsVisible(false)} /><View style={[styles.toolSheet, { backgroundColor: colors.card }]}><View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Settings</Text><Pressable onPress={() => setSettingsVisible(false)} style={[styles.closeButton, { backgroundColor: colors.secondary }]}><Ionicons name="close" size={22} color={colors.mutedForeground} /></Pressable></View><View style={[styles.settingRow, { borderColor: colors.border }]}><View><Text style={[styles.toggleTitle, { color: colors.foreground }]}>Sound</Text><Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Button feedback sound</Text></View><Switch value={soundEnabled} onValueChange={saveSoundPreference} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} /></View><View style={[styles.themeRow, { borderColor: colors.border }]}><View><Text style={[styles.toggleTitle, { color: colors.foreground }]}>Theme</Text><Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>{theme === 'light' ? 'Light appearance' : 'Dark appearance'}</Text></View><View style={[styles.themeChoices, { backgroundColor: colors.secondary }]}>{(['light', 'dark'] as const).map((mode) => <Pressable key={mode} accessibilityRole="button" onPress={() => setTheme(mode)} style={[styles.themeChoice, { backgroundColor: theme === mode ? colors.primary : 'transparent' }]}><Text style={[styles.themeChoiceText, { color: theme === mode ? colors.primaryForeground : colors.foreground }]}>{mode === 'light' ? 'Light' : 'Dark'}</Text></Pressable>)}</View></View></View></View>
     </Modal>
    <MagicSheet visible={showMagic} onClose={() => setShowMagic(false)} />
  </View>;
}

function ActivityIndicator({ color }: { color: string }) { return <View style={[styles.loadingDot, { backgroundColor: color }]} />; }

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingDot: { width: 12, height: 12, borderRadius: 6 },
  displayWrap: { flex: 1, minHeight: 220, justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: 30 },
  displayScroll: { width: '100%' },
  displayScrollContent: { minWidth: '100%', alignItems: 'flex-end', justifyContent: 'flex-end' },
  resultStack: { alignItems: 'flex-end' },
  displayExpression: { fontFamily: 'Inter_400Regular', fontSize: 48, letterSpacing: -1.5 },
  displayResult: { fontFamily: 'Inter_500Medium', fontSize: 36, letterSpacing: -1, marginTop: 12 },
  keypad: { gap: 12 },
  toolBar: { flexDirection: 'row', alignItems: 'center', gap: 28, borderTopWidth: 1, paddingTop: 14, paddingBottom: 14, paddingHorizontal: 10 },
  toolButton: { width: 44, height: 38, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  key: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  keyText: { fontFamily: 'Inter_600SemiBold', fontSize: 23 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 25, 47, 0.36)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, maxHeight: '92%', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD4E4', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 24 },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.5, marginBottom: 4 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -1 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F9' },
  sheetContent: { padding: 24, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8, marginTop: 18 },
  select: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'Inter_500Medium', fontSize: 15 },
  helper: { marginTop: 12, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  helperText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 8 },
  toggleRow: { marginTop: 22, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  advancedRow: { paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  advancedText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  advancedPanel: { borderRadius: 16, padding: 15, gap: 9 },
  advancedCaption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  disableText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  toolSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 22, paddingBottom: 32, maxHeight: '78%', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  panelContent: { padding: 24, gap: 14 },
  emptyText: { textAlign: 'center', paddingVertical: 30, fontFamily: 'Inter_400Regular' },
  historyRow: { paddingVertical: 13, borderBottomWidth: 1 },
  historyExpression: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  historyResult: { fontFamily: 'Inter_600SemiBold', fontSize: 19, marginTop: 3 },
  panelHint: { fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 4 },
  scienceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scienceButton: { width: '22%', minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scienceText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  memoryRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  memoryButton: { flex: 1, minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  clearHistoryButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  clearHistoryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14 },
  conversionResult: { fontFamily: 'Inter_700Bold', fontSize: 28, textAlign: 'center', marginTop: 16 },
  settingRow: { marginHorizontal: 24, marginTop: 22, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeRow: { marginHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  themeChoices: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  themeChoice: { minWidth: 58, minHeight: 36, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  themeChoiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  cancelButton: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  activateButton: { flex: 1.5, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activateText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});