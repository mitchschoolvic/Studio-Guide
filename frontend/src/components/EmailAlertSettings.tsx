import { useState } from 'react';
import { AlertConfig, AlertRule, AlertTriggerType } from '../../../src/shared/types';
import { TRIGGER_LABELS, sendTestAlert } from '../services/alertService';
import { useUI } from '../contexts/UIContext';
import { v4 as uuidv4 } from 'uuid';

interface EmailAlertSettingsProps {
    alertConfig: AlertConfig | undefined;
    onSave: (config: AlertConfig) => void;
}

export function EmailAlertSettings({ alertConfig, onSave }: EmailAlertSettingsProps) {
    const { showToast } = useUI();
    const [rules, setRules] = useState<AlertRule[]>(alertConfig?.rules || []);
    const [testStatus, setTestStatus] = useState<string>('');

    // Local state for new rule creation
    const [newTrigger, setNewTrigger] = useState<AlertTriggerType>('camera_connected');
    const [newEndpoint, setNewEndpoint] = useState<string>('');
    const [newSubject, setNewSubject] = useState<string>('');

    const getDefaultSubject = (trigger: AlertTriggerType) =>
        trigger === 'camera_connected' ? 'Studio Camera Connected' : 'Studio Camera Disconnected';

    const handleAddRule = () => {
        if (!newEndpoint.trim() || !newEndpoint.startsWith('http')) {
            showToast("Invalid URL");
            return;
        }

        const newRule: AlertRule = {
            id: uuidv4(),
            enabled: true,
            trigger: newTrigger,
            endpointUrl: newEndpoint.trim(),
            subject: newSubject.trim() || getDefaultSubject(newTrigger)
        };

        const updatedRules = [...rules, newRule];
        setRules(updatedRules);
        onSave({ rules: updatedRules });

        // Reset input but keep trigger for easier multiple entry
        setNewEndpoint('');
        setNewSubject('');
        showToast("Rule Added");
    };

    const handleRemoveRule = (id: string) => {
        const updatedRules = rules.filter(r => r.id !== id);
        setRules(updatedRules);
        onSave({ rules: updatedRules });
    };

    const handleToggleRule = (id: string) => {
        const updatedRules = rules.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
        );
        setRules(updatedRules);
        onSave({ rules: updatedRules });
    };

    const handleUpdateEndpoint = (id: string, url: string) => {
        const updatedRules = rules.map(r =>
            r.id === id ? { ...r, endpointUrl: url } : r
        );
        setRules(updatedRules);
        onSave({ rules: updatedRules });
    };

    const handleUpdateSubject = (id: string, subject: string) => {
        const updatedRules = rules.map(r =>
            r.id === id ? { ...r, subject: subject } : r
        );
        setRules(updatedRules);
        onSave({ rules: updatedRules });
    };

    const handleTestRule = async (rule: AlertRule) => {
        setTestStatus(`Testing rule for ${rule.trigger}...`);
        const result = await sendTestAlert(rule.trigger, rule.endpointUrl, rule.subject);

        if (result.success) {
            setTestStatus('Test sent successfully!');
            showToast("Test Sent");
            setTimeout(() => setTestStatus(''), 3000);
        } else {
            setTestStatus(`Error: ${result.error}`);
            showToast("Test Failed");
        }
    };

    return (
        <div style={{ padding: 10, border: '1px solid #444', borderRadius: 4, background: '#1a1a1a' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#4facfe' }}>Email Alert Configuration</h3>

            <div style={{ marginBottom: 20, padding: 10, background: '#222', borderRadius: 4 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9em', color: '#aaa' }}>Add New Alert Trigger</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select
                        value={newTrigger}
                        onChange={(e) => setNewTrigger(e.target.value as AlertTriggerType)}
                        style={{ padding: 8, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}
                    >
                        {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>

                    <input
                        type="text"
                        value={newEndpoint}
                        onChange={(e) => setNewEndpoint(e.target.value)}
                        placeholder="Power Automate HTTP Endpoint URL"
                        style={{ padding: 8, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}
                    />

                    <input
                        type="text"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder={`Subject (Default: ${getDefaultSubject(newTrigger)})`}
                        style={{ padding: 8, background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4 }}
                    />

                    <button
                        onClick={handleAddRule}
                        style={{
                            padding: 8, background: '#4facfe', color: '#fff', border: 'none',
                            borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Add Rule
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.9em', color: '#aaa' }}>Active Rules ({rules.length})</h4>

                {rules.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                        No alert rules configured.
                    </div>
                )}

                {rules.map(rule => (
                    <div key={rule.id} style={{
                        padding: 10, background: '#2a2a2a', border: '1px solid #444', borderRadius: 4,
                        opacity: rule.enabled ? 1 : 0.6
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#ddd' }}>
                                {TRIGGER_LABELS[rule.trigger]}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => handleTestRule(rule)}
                                    title="Send Test Alert"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
                                >
                                    🔔
                                </button>
                                <button
                                    onClick={() => handleRemoveRule(rule.id)}
                                    title="Delete Rule"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em' }}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={() => handleToggleRule(rule.id)}
                                    title="Enable/Disable Rule"
                                />
                                <input
                                    type="text"
                                    value={rule.endpointUrl}
                                    onChange={(e) => handleUpdateEndpoint(rule.id, e.target.value)}
                                    placeholder="Endpoint URL"
                                    style={{
                                        flex: 1, padding: 6, background: '#111', color: '#aaa',
                                        border: '1px solid #333', borderRadius: 4, fontSize: '0.8em'
                                    }}
                                />
                            </div>
                            <input
                                type="text"
                                value={rule.subject || ''}
                                onChange={(e) => handleUpdateSubject(rule.id, e.target.value)}
                                placeholder="Email Subject"
                                style={{
                                    width: '100%', padding: 6, background: '#111', color: '#aaa',
                                    border: '1px solid #333', borderRadius: 4, fontSize: '0.8em',
                                    marginLeft: 23 // Align with URL input (checkbox width + gap)
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {testStatus && (
                <div style={{
                    marginTop: 15, padding: 8, borderRadius: 4, fontSize: '0.85em',
                    background: testStatus.includes('Error') ? '#4a1a1a' : '#1a4a2a',
                    color: testStatus.includes('Error') ? '#ff8888' : '#88ff88'
                }}>
                    {testStatus}
                </div>
            )}
        </div>
    );
}
