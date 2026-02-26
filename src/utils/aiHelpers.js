import { Command as TauriCommand } from '@tauri-apps/plugin-shell';

export const callAppleAI = async (prompt, responseFormat = 'json', base64Image = null, mimeType = null) => {
    try {
        const command = TauriCommand.create('apple-ai-helper');
        const child = await command.spawn();

        const requestPayload = JSON.stringify({
            prompt,
            responseFormat,
            type: base64Image ? 'ocr' : 'text',
            base64Image,
            mimeType
        });

        await child.write(requestPayload + '\n');

        // For simplicity, wait for child to finish and capture output from listeners
        return new Promise((resolve, reject) => {
            let out = '';
            let err = '';
            command.stdout.on('data', line => { out += line; });
            command.stderr.on('data', line => { err += line; });
            command.on('close', data => {
                try {
                    const parsed = JSON.parse(out);
                    if (parsed.success) {
                        resolve(parsed.text);
                    } else {
                        reject(new Error(parsed.error || 'Unknown Apple AI error'));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Apple AI response: ' + out));
                }
            });
            command.on('error', error => reject(error));
        });
    } catch (error) {
        console.error('Apple AI call failed:', error);
        throw error;
    }
};
