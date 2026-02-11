/**
 * Alert Service
 * Handles triggering email alerts based on configured rules
 */

import { AlertConfig, AlertTriggerType } from '../../../src/shared/types';

// Device information for alerts
export interface DeviceInfo {
    deviceId: string;
    label: string;
}

// Embedded HTML templates for email alerts
const TEMPLATES: Record<AlertTriggerType, string> = {
    camera_connected: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; }
        .container { padding: 20px; border: 1px solid #ccc; max-width: 600px; }
        .header { background-color: #28a745; color: white; padding: 10px; font-size: 24px; }
        .content { padding: 20px; }
        .device-name { font-weight: bold; color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">USB Webcam Connected</div>
        <div class="content">
            <p>A USB webcam has been <strong>connected</strong> to the system.</p>
            <p><strong>Device:</strong> <span class="device-name">{{ device_name }}</span></p>
            <p><strong>Timestamp:</strong> {{ timestamp }}</p>
        </div>
    </div>
</body>
</html>`,
    camera_disconnected: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; }
        .container { padding: 20px; border: 1px solid #ccc; max-width: 600px; }
        .header { background-color: #d9534f; color: white; padding: 10px; font-size: 24px; }
        .content { padding: 20px; }
        .device-name { font-weight: bold; color: #d9534f; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">USB Webcam Disconnected</div>
        <div class="content">
            <p>A USB webcam has been <strong>disconnected</strong> from the system.</p>
            <p><strong>Device:</strong> <span class="device-name">{{ device_name }}</span></p>
            <p><strong>Timestamp:</strong> {{ timestamp }}</p>
        </div>
    </div>
</body>
</html>`
};

// Trigger labels for UI display
export const TRIGGER_LABELS: Record<AlertTriggerType, string> = {
    camera_connected: 'When USB Webcam is connected',
    camera_disconnected: 'When USB Webcam is disconnected'
};

/**
 * Trigger alerts for a specific event type
 * Finds matching enabled rules and sends HTTP POST for each
 */
export async function triggerAlert(
    trigger: AlertTriggerType,
    alertConfig: AlertConfig | undefined,
    deviceInfo?: DeviceInfo
): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const deviceName = deviceInfo?.label || 'Unknown USB Camera';

    if (!alertConfig?.rules) {
        return { success: true, errors: [] };
    }

    const matchingRules = alertConfig.rules.filter(
        rule => rule.enabled && rule.trigger === trigger
    );

    if (matchingRules.length === 0) {
        console.log(`[AlertService] No enabled rules for trigger: ${trigger}`);
        return { success: true, errors: [] };
    }

    // Log to main process
    window.electronAPI?.log.info(`Triggering ${matchingRules.length} alert(s) for: ${trigger} - Device: "${deviceName}"`);
    console.log(`[AlertService] Triggering ${matchingRules.length} alert(s) for: ${trigger}`);

    for (const rule of matchingRules) {
        try {
            const html = TEMPLATES[trigger]
                .replace('{{ timestamp }}', new Date().toLocaleString())
                .replace('{{ device_name }}', deviceName);

            // Default subject if not provided (handles old rules or empty fields)
            const subject = rule.subject || (trigger === 'camera_connected' ? 'Studio Camera Connected' : 'Studio Camera Disconnected');

            const result = await window.electronAPI?.sendEmailAlert(rule.endpointUrl, html, subject);

            if (!result?.success) {
                const errorMsg = `Alert failed for rule ${rule.id}: ${result?.error || 'Unknown error'}`;
                window.electronAPI?.log.error(errorMsg);
                console.error(`[AlertService] ${errorMsg}`);
                errors.push(errorMsg);
            } else {
                window.electronAPI?.log.info(`Alert sent successfully for device: "${deviceName}" (rule: ${rule.id})`);
                console.log(`[AlertService] Alert sent successfully for rule: ${rule.id}`);
            }
        } catch (error: any) {
            const errorMsg = `Exception sending alert for rule ${rule.id}: ${error.message}`;
            window.electronAPI?.log.error(errorMsg);
            console.error(`[AlertService] ${errorMsg}`);
            errors.push(errorMsg);
        }
    }

    return { success: errors.length === 0, errors };
}

/**
 * Send a test alert for a specific trigger type to a given URL
 */
export async function sendTestAlert(
    trigger: AlertTriggerType,
    endpointUrl: string,
    subject?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const html = TEMPLATES[trigger].replace(
            '{{ timestamp }}',
            new Date().toLocaleString() + ' (TEST)'
        );

        // Default subject for tests if not provided
        const finalSubject = subject || (trigger === 'camera_connected' ? 'Studio Camera Connected' : 'Studio Camera Disconnected') + ' (TEST)';

        const result = await window.electronAPI?.sendEmailAlert(endpointUrl, html, finalSubject);

        if (!result?.success) {
            return { success: false, error: result?.error || 'Unknown error' };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
