import { useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function GoogleAuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        // Send error to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: error
          }, window.location.origin);
        }
        window.close();
        return;
      }

      if (!code || !state) {
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Missing authorization code or state'
          }, window.location.origin);
        }
        window.close();
        return;
      }

      try {
        // Exchange code for tokens
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Send success to parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              data: data
            }, window.location.origin);
          }
        } else {
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_ERROR',
              error: data.error || 'Authentication failed'
            }, window.location.origin);
          }
        }
      } catch (error) {
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Network error during authentication'
          }, window.location.origin);
        }
      }

      window.close();
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing Authentication
        </h2>
        <p className="text-gray-600">
          Please wait while we complete your Google Analytics connection...
        </p>
      </div>
    </div>
  );
}