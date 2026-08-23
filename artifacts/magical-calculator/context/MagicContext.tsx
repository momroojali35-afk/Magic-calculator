import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type RevealType = 'number' | 'text' | 'emoji' | 'prediction';
export type TriggerMethod = 'equals' | 'operations' | 'manual';
export type RoutineType = 'standard' | 'audience-number';
export type MagicStatus = 'NORMAL' | 'MAGIC_CONFIGURED' | 'COUNTING' | 'REVEAL' | 'COMPLETED';

export interface MagicConfig {
  routineType: RoutineType;
  revealType: RevealType;
  secret: string;
  triggerOperator?: '+' | '-';
  secretTarget?: string;
  triggerMethod: TriggerMethod;
  triggerCount: number;
  oneTimeOnly: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface MagicHistoryItem {
  id: string;
  createdAt: string;
  routineType: RevealType;
  triggerCount: number;
  status: 'Revealed' | 'Disabled' | 'Active';
}

interface MagicContextValue {
  config: MagicConfig | null;
  history: MagicHistoryItem[];
  status: MagicStatus;
  operationCount: number;
  isLoaded: boolean;
  saveConfig: (config: Omit<MagicConfig, 'enabled' | 'createdAt'>) => Promise<void>;
  clearMagic: () => Promise<void>;
  countOperation: () => boolean;
  finishReveal: () => Promise<void>;
  resetCounter: () => void;
}

const CONFIG_KEY = '@magical-calculator/config';
const HISTORY_KEY = '@magical-calculator/history';
const MagicContext = createContext<MagicContextValue | null>(null);

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function MagicProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<MagicConfig | null>(null);
  const [history, setHistory] = useState<MagicHistoryItem[]>([]);
  const [operationCount, setOperationCount] = useState(0);
  const [status, setStatus] = useState<MagicStatus>('NORMAL');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CONFIG_KEY), AsyncStorage.getItem(HISTORY_KEY)]).then(([storedConfig, storedHistory]) => {
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig) as MagicConfig;
        setConfig(parsed);
        setStatus(parsed.enabled ? 'MAGIC_CONFIGURED' : 'COMPLETED');
      }
      if (storedHistory) setHistory(JSON.parse(storedHistory) as MagicHistoryItem[]);
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const saveConfig = async (next: Omit<MagicConfig, 'enabled' | 'createdAt'>) => {
    const saved: MagicConfig = { ...next, enabled: true, createdAt: new Date().toISOString() };
    setConfig(saved);
    setOperationCount(0);
    setStatus('MAGIC_CONFIGURED');
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(saved));
    const item: MagicHistoryItem = { id: makeId(), createdAt: saved.createdAt, routineType: saved.revealType, triggerCount: saved.triggerCount, status: 'Active' };
    const nextHistory = [item, ...history].slice(0, 20);
    setHistory(nextHistory);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const clearMagic = async () => {
    setConfig(null);
    setOperationCount(0);
    setStatus('NORMAL');
    await AsyncStorage.removeItem(CONFIG_KEY);
    const nextHistory = history.map((item) => item.status === 'Active' ? { ...item, status: 'Disabled' as const } : item);
    setHistory(nextHistory);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const countOperation = () => {
    if (!config?.enabled || config.triggerMethod === 'manual') return false;
    const next = operationCount + 1;
    setOperationCount(next);
    setStatus('COUNTING');
    return next >= config.triggerCount;
  };

  const finishReveal = async () => {
    setStatus('REVEAL');
    if (config?.oneTimeOnly) {
      const completed = { ...config, enabled: false };
      setConfig(completed);
      setStatus('COMPLETED');
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(completed));
      const nextHistory = history.map((item, index) => index === 0 ? { ...item, status: 'Revealed' as const } : item);
      setHistory(nextHistory);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    }
  };

  const resetCounter = () => {
    setOperationCount(0);
    if (config?.enabled) setStatus('MAGIC_CONFIGURED');
  };

  const value = useMemo(() => ({ config, history, status, operationCount, isLoaded, saveConfig, clearMagic, countOperation, finishReveal, resetCounter }), [config, history, status, operationCount, isLoaded]);
  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}

export function useMagic() {
  const context = useContext(MagicContext);
  if (!context) throw new Error('useMagic must be used within MagicProvider');
  return context;
}