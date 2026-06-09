/**
 * onboarding.js — Beginner-Friendly Guided Tour System
 * Handles: welcome modal, multi-step spotlight tour, info tooltips, help button
 */

;(function () {
    'use strict';

    // ─── Tour Step Definitions ─────────────────────────────────────────────────
    const TOUR_STEPS = [
        {
            target: '#task-select',
            title: '① Choose a Task Preset',
            body: 'Pick a pre-built program here. <strong>Start with "Full Joint Calibration Sweep"</strong> to see all movements right away — no coding needed!',
            placement: 'left',
            pulse: true,
        },
        {
            target: '#btn-play',
            title: '② Run the Simulation',
            body: 'Press <strong>RUN</strong> to start. Use <strong>PAUSE</strong> to freeze the arm mid-motion, <strong>STEP</strong> to advance one command at a time, and <strong>STOP</strong> to reset.',
            placement: 'left',
        },
        {
            target: '#canvas-container',
            title: '③ 3-D Viewport',
            body: '<strong>Left-drag</strong> to rotate the camera · <strong>Scroll</strong> to zoom · <strong>Right-drag</strong> to pan. The cyan trail is the planned path; the magenta trail shows the actual (error-affected) path.',
            placement: 'right',
        },
        {
            target: '.viewport-controls',
            title: '④ Viewport Controls',
            body: 'Toggle the <strong>grid</strong>, enable/disable the <strong>path trail</strong>, clear history, reset the camera angle, or switch to <strong>wireframe</strong> mode for a technical view.',
            placement: 'right',
        },
        {
            target: '.left-panel',
            title: '⑤ Controller Tuning',
            body: 'These sliders adjust the robot\'s <strong>PID controller</strong> and physical disturbances in real-time. Crank up "Joint Friction" or "Sensor Noise" and watch the error metrics rise!',
            placement: 'right',
        },
        {
            target: '.telemetry-dashboard',
            title: '⑥ Live Telemetry Charts',
            body: 'Switch between the <strong>TCP Position</strong> chart (where the arm actually is) and the <strong>RMS Error</strong> waveform (how far off it is) to monitor performance.',
            placement: 'top',
        },
        {
            target: '#editor-raw',
            title: '⑦ MotionScript Editor',
            body: 'Write your own movement programs using commands like <code>MOVE 0 150 100</code> or <code>GRIPPER CLOSE</code>. Switch to the <strong>ARDUINO</strong> or <strong>G-CODE</strong> tabs to export real hardware code!',
            placement: 'left',
        },
        {
            target: '.app-footer',
            title: '⑧ Live Telemetry Bar',
            body: 'The footer shows <strong>real-time joint angles</strong>, velocity profile, the active program step, and the controller loop rate — just like a real robot HMI panel.',
            placement: 'top',
            last: true,
        },
    ];

    // ─── State ─────────────────────────────────────────────────────────────────
    let overlay, spotlight, tooltipEl, stepCounter, prevBtn, nextBtn, skipBtn;
    let currentStep = 0;
    let tourActive = false;

    // ─── Welcome Modal ─────────────────────────────────────────────────────────
    function showWelcomeModal() {
        const modal = document.getElementById('welcome-modal');
        if (modal) modal.classList.add('visible');
    }

    function hideWelcomeModal() {
        const modal = document.getElementById('welcome-modal');
        if (modal) modal.classList.remove('visible');
    }

    // ─── Tour DOM ──────────────────────────────────────────────────────────────
    function buildTourDOM() {
        if (document.getElementById('tour-overlay')) {
            // Already built — re-cache references in case they were GC'd
            overlay    = document.getElementById('tour-overlay');
            spotlight  = document.getElementById('tour-spotlight');
            tooltipEl  = document.getElementById('tour-tooltip');
            stepCounter = document.getElementById('tour-step-counter');
            prevBtn    = document.getElementById('tour-prev');
            nextBtn    = document.getElementById('tour-next');
            skipBtn    = document.getElementById('tour-skip');
            return;
        }

        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.className = 'tour-overlay';

        spotlight = document.createElement('div');
        spotlight.id = 'tour-spotlight';
        spotlight.className = 'tour-spotlight';

        tooltipEl = document.createElement('div');
        tooltipEl.id = 'tour-tooltip';
        tooltipEl.className = 'tour-tooltip';
        tooltipEl.innerHTML = `
            <div class="tour-tooltip-header">
                <span class="tour-badge">GUIDED TOUR</span>
                <span id="tour-step-counter" class="tour-step-counter">1 / ${TOUR_STEPS.length}</span>
            </div>
            <h3 id="tour-title" class="tour-title"></h3>
            <p id="tour-body" class="tour-body"></p>
            <div class="tour-actions">
                <button id="tour-skip" class="tour-btn tour-btn-ghost">Skip Tour</button>
                <div style="display:flex;gap:8px;">
                    <button id="tour-prev" class="tour-btn tour-btn-secondary">← Back</button>
                    <button id="tour-next" class="tour-btn tour-btn-primary">Next →</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(spotlight);
        document.body.appendChild(tooltipEl);

        // Cache refs
        stepCounter = document.getElementById('tour-step-counter');
        prevBtn     = document.getElementById('tour-prev');
        nextBtn     = document.getElementById('tour-next');
        skipBtn     = document.getElementById('tour-skip');

        // ── FIX: single unified handler — no stacking of listeners ──────────
        prevBtn.addEventListener('click', function () {
            navigateTour(-1);
        });

        nextBtn.addEventListener('click', function () {
            // Check whether we are on the LAST step at the moment of the click
            if (TOUR_STEPS[currentStep] && TOUR_STEPS[currentStep].last) {
                endTour();
            } else {
                navigateTour(1);
            }
        });

        skipBtn.addEventListener('click', endTour);
    }

    // ─── Tour Control ──────────────────────────────────────────────────────────
    function startTour(stepIndex) {
        stepIndex = (typeof stepIndex === 'number') ? stepIndex : 0;
        buildTourDOM();
        currentStep = stepIndex;
        tourActive  = true;
        overlay.classList.add('active');
        showStep(currentStep);
    }

    function endTour() {
        tourActive = false;
        if (overlay)    overlay.classList.remove('active');
        if (spotlight)  spotlight.style.cssText = '';
        if (tooltipEl)  tooltipEl.classList.remove('visible');

        document.querySelectorAll('.tour-pulse-target').forEach(function (el) {
            el.classList.remove('tour-pulse-target');
        });

        localStorage.setItem('motionx_tour_done', '1');
        showToast('Tour complete! Click the <span style="color:var(--cyan)">? HELP</span> button anytime to restart.', 4000);
    }

    function navigateTour(dir) {
        var next = currentStep + dir;
        if (next < 0 || next >= TOUR_STEPS.length) return;
        currentStep = next;
        showStep(currentStep);
    }

    function showStep(index) {
        var step     = TOUR_STEPS[index];
        var targetEl = document.querySelector(step.target);

        // Remove old pulse
        document.querySelectorAll('.tour-pulse-target').forEach(function (el) {
            el.classList.remove('tour-pulse-target');
        });

        // Skip to next if element not found
        if (!targetEl) {
            if (index < TOUR_STEPS.length - 1) { navigateTour(1); }
            return;
        }

        // Update text
        document.getElementById('tour-title').textContent = step.title;
        document.getElementById('tour-body').innerHTML    = step.body;
        stepCounter.textContent = (index + 1) + ' / ' + TOUR_STEPS.length;

        // Prev button
        prevBtn.disabled = (index === 0);

        // Next / Done button — just update label + class, NO listener changes
        if (step.last) {
            nextBtn.textContent = '✓ Done';
            nextBtn.classList.add('tour-btn-done');
        } else {
            nextBtn.textContent = 'Next →';
            nextBtn.classList.remove('tour-btn-done');
        }

        // Scroll into view, then position spotlight + tooltip
        targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        requestAnimationFrame(function () {
            positionSpotlight(targetEl);
            positionTooltip(targetEl, step);
            if (step.pulse) targetEl.classList.add('tour-pulse-target');
            tooltipEl.classList.add('visible');
        });
    }

    // ─── Spotlight ────────────────────────────────────────────────────────────
    function positionSpotlight(el) {
        var PAD  = 10;
        var rect = el.getBoundingClientRect();
        spotlight.style.cssText = [
            'position:fixed',
            'top:'    + (rect.top    - PAD) + 'px',
            'left:'   + (rect.left   - PAD) + 'px',
            'width:'  + (rect.width  + PAD * 2) + 'px',
            'height:' + (rect.height + PAD * 2) + 'px',
            'border-radius:8px',
            'pointer-events:none',
            'z-index:9998',
            'box-shadow:0 0 0 9999px rgba(4,6,18,0.82)',
            'border:2px solid var(--cyan)',
            'transition:all 0.35s cubic-bezier(.4,0,.2,1)',
        ].join(';');
    }

    // ─── Tooltip Positioning ──────────────────────────────────────────────────
    function positionTooltip(el, step) {
        var MARGIN    = 18;
        var tipW      = 320;
        var rect      = el.getBoundingClientRect();
        var tipH      = tooltipEl.offsetHeight || 200;
        var placement = step.placement || 'right';
        var top, left;

        if (placement === 'right') {
            top  = rect.top + rect.height / 2 - tipH / 2;
            left = rect.right + MARGIN;
        } else if (placement === 'left') {
            top  = rect.top + rect.height / 2 - tipH / 2;
            left = rect.left - tipW - MARGIN;
        } else if (placement === 'top') {
            top  = rect.top - tipH - MARGIN;
            left = rect.left + rect.width / 2 - tipW / 2;
        } else {
            top  = rect.bottom + MARGIN;
            left = rect.left + rect.width / 2 - tipW / 2;
        }

        // Clamp to viewport
        var vw = window.innerWidth, vh = window.innerHeight;
        top  = Math.max(16, Math.min(vh - tipH - 16, top));
        left = Math.max(16, Math.min(vw - tipW - 16, left));

        tooltipEl.style.cssText = 'width:' + tipW + 'px;top:' + top + 'px;left:' + left + 'px;';
    }

    // ─── Info Tooltips (hover) ────────────────────────────────────────────────
    function initInfoTooltips() {
        document.querySelectorAll('[data-info]').forEach(function (el) {
            var tipDiv = null;

            el.addEventListener('mouseenter', function () {
                tipDiv = document.createElement('div');
                tipDiv.className = 'info-tooltip';
                tipDiv.innerHTML = el.getAttribute('data-info');
                document.body.appendChild(tipDiv);

                var rect = el.getBoundingClientRect();
                tipDiv.style.top  = (rect.top - tipDiv.offsetHeight - 10) + 'px';
                tipDiv.style.left = (rect.left + rect.width / 2 - tipDiv.offsetWidth / 2) + 'px';
                requestAnimationFrame(function () {
                    if (tipDiv) tipDiv.classList.add('visible');
                });
            });

            el.addEventListener('mouseleave', function () {
                if (tipDiv) { tipDiv.remove(); tipDiv = null; }
            });
        });
    }

    // ─── Toast Helper ─────────────────────────────────────────────────────────
    function showToast(msg, duration) {
        duration = duration || 2500;
        var toast    = document.getElementById('toast');
        var toastMsg = document.getElementById('toast-message');
        if (!toast || !toastMsg) return;
        toastMsg.innerHTML = msg;
        toast.classList.add('show');
        setTimeout(function () { toast.classList.remove('show'); }, duration);
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    function init() {
        var btnStartTour   = document.getElementById('btn-welcome-tour');
        var btnSkipWelcome = document.getElementById('btn-welcome-skip');
        var helpBtn        = document.getElementById('btn-help');

        if (btnStartTour) {
            btnStartTour.addEventListener('click', function () {
                hideWelcomeModal();
                setTimeout(function () { startTour(0); }, 300);
            });
        }

        if (btnSkipWelcome) {
            btnSkipWelcome.addEventListener('click', function () {
                hideWelcomeModal();
                localStorage.setItem('motionx_tour_done', '1');
            });
        }

        if (helpBtn) {
            helpBtn.addEventListener('click', function () {
                showWelcomeModal();
            });
        }

        initInfoTooltips();

        // Auto-show welcome modal for first-time visitors
        if (!localStorage.getItem('motionx_tour_done')) {
            setTimeout(showWelcomeModal, 800);
        }
    }

    // DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
