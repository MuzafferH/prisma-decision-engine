/**
 * DEMO-MODE.JS — Transparent fetch interceptor for hackathon video recording.
 *
 * Activates when URL contains ?demo parameter.
 * Patches window.fetch to return pre-saved API responses.
 * Zero changes to chat.js, dashboard.js, or any rendering code.
 *
 * Execution order:
 *   1. IIFE runs immediately on script load (before gate script)
 *   2. Patches fetch synchronously (gate init calls /api/gate immediately)
 *   3. Loads response JSONs asynchronously via originalFetch
 *   4. DOMContentLoaded: patches legacy loadDemoData, auto-loads CSV
 */
(function() {
  // 1. Check URL param — exit if not demo
  if (!new URLSearchParams(location.search).has('demo')) return;

  // 2. Patch fetch SYNCHRONOUSLY (before gate script calls /api/gate)
  var originalFetch = window.fetch;
  var callIndex = 0;
  var responses = null; // loaded async

  window.fetch = function(url, options) {
    // Only intercept string URLs targeting our API
    if (typeof url !== 'string' || !url.includes('/api/')) {
      return originalFetch.call(this, url, options);
    }

    // /api/gate — bypass password
    if (url.includes('/api/gate')) {
      return Promise.resolve(new Response(JSON.stringify(
        options && options.method === 'POST' ? { valid: true } : { gated: false }
      ), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }

    // /api/chat — return pre-saved responses in sequence
    if (url.includes('/api/chat')) {
      return new Promise(function(resolve) {
        // Wait for JSONs to finish loading (10s timeout prevents hung demo)
        var waited = 0;
        function waitForData() {
          if (responses || waited >= 10000) {
            // Simulate API latency
            setTimeout(function() {
              if (!responses) {
                resolve(new Response(JSON.stringify({
                  message: 'Demo data failed to load.', toolCall: null,
                  stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                return;
              }

              // Set sim card label for the simulation response
              if (callIndex === 1 && typeof Dashboard !== 'undefined') {
                Dashboard._lastSimulationPrompt = 'What happens if I reduce the fleet from 7 drivers to 5?';
              }

              if (callIndex < responses.length) {
                resolve(new Response(JSON.stringify(responses[callIndex++]),
                  { status: 200, headers: { 'Content-Type': 'application/json' } }));
              } else {
                // Follow-up calls after all responses used: empty text (ends sendFollowUp loop)
                resolve(new Response(JSON.stringify({
                  message: '', toolCall: null,
                  stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }
                }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
              }
            }, 3000);
          } else {
            waited += 50;
            setTimeout(waitForData, 50);
          }
        }
        waitForData();
      });
    }

    // /api/refine-recommendations — return canned refinement
    if (url.includes('/api/refine-recommendations')) {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve(new Response(JSON.stringify({
            action: 'Keep all 7 drivers. The data shows cutting to 5 pushes overtime past the tipping point where sick days and late deliveries spike exponentially.',
            watch: 'Driver D2 is your early warning system. Their late delivery rate has tripled since December \u2014 if it crosses 40%, the entire fleet is at risk of cascading overload.',
            trigger: 'If average overtime exceeds 1.5 hours per driver per day for two consecutive weeks, pause any headcount reduction plans and investigate root cause.'
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }, 1500);
      });
    }

    // Pass through anything else
    return originalFetch.call(this, url, options);
  };

  // 3. Load response JSONs async (using original fetch — won't be intercepted)
  Promise.all([
    originalFetch('/demo-data/analysis-response.json').then(function(r) { return r.json(); }),
    originalFetch('/demo-data/simulation-response.json').then(function(r) { return r.json(); })
  ]).then(function(pair) {
    responses = [pair[0], pair[1]];
    console.log('[Demo] Response JSONs loaded:', responses.length, 'responses');
  }).catch(function(err) {
    console.error('[Demo] Failed to load response JSONs:', err);
  });

  // 4. DOMContentLoaded: patch old demo handler + auto-load CSV
  document.addEventListener('DOMContentLoaded', function() {
    // Override legacy loadDemoData (fires BEFORE dashboard.js's handler
    // because this script loads before dashboard.js)
    if (typeof Dashboard !== 'undefined') {
      Dashboard.loadDemoData = function() {
        Dashboard._mode = 'live'; // Full experience, not template-only
        console.log('[Demo] Legacy loadDemoData patched to no-op');
      };
    }

    // Add subtle indicator
    var dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:9999;font:500 8px/1 "Geist",sans-serif;color:rgba(180,125,125,0.35);letter-spacing:0.1em;pointer-events:none;';
    dot.textContent = 'DEMO';
    document.body.appendChild(dot);

    // Auto-load CSV after init settles
    setTimeout(function() {
      originalFetch('/demo-data/driver_performance.csv')
        .then(function(res) { return res.text(); })
        .then(function(text) {
          var file = new File([text], 'driver_performance.csv', { type: 'text/csv' });
          if (typeof Chat !== 'undefined') {
            Chat.handleCSVUpload(file);
          }
        })
        .catch(function(err) {
          console.error('[Demo] Failed to auto-load CSV:', err);
        });
    }, 600);
  });

  console.log('[Demo] Demo mode activated — fetch interceptor installed');
})();
