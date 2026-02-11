import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface UIContextValue {
    // Toast
    showToast: (message: string) => void;
    toastMessage: string | null;

    // Modals (example structure)
    isSettingsOpen: boolean;
    setSettingsOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isSettingsOpen, setSettingsOpen] = useState(false);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
    }, []);

    const value: UIContextValue = {
        showToast,
        toastMessage,
        isSettingsOpen,
        setSettingsOpen
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within UIProvider');
    return context;
}
