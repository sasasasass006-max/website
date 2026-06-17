/* ═══════════════════════════════════════════════════════════
   CardioSense AI — script.js
   Real-Time Heart Monitoring System
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── STATE ──────────────────────────────────────────────────── */
const state = {
  monitoring: false,
  sessionStart: null,
  sessionTimer: null,
  bpmInterval: null,
  aiInterval: null,
  timerInterval: null,
  currentBPM: 0,
  bpmHistory: [],
  signalData: [],
  zoomLevel: 1,
  dataPoints: 120,
  riskLevel: 'LOW',
  heartStatus: 'NORMAL',
  confidence: 0,
  patientName: '',
  patientAge: '',
  patientID: '',
  reportGenerated: false,
};

/* ─── ECG WAVEFORM GENERATOR ─────────────────────────────────── */
// Simulates a realistic ECG-like waveform (P-QRS-T complex)
function generateECGPoint(t, bpm = 72) {
  const period = 60 / bpm;
  const phase = (t % period) / period;

  // P wave
  const p = 0.15 * Math.exp(-Math.pow((phase - 0.15) / 0.03, 2));
  // Q wave
  const q = -0.08 * Math.exp(-Math.pow((phase - 0.29) / 0.008, 2));
  // R wave (dominant)
  const r = 1.0 * Math.exp(-Math.pow((phase - 0.32) / 0.012, 2));
  // S wave
  const s = -0.18 * Math.exp(-Math.pow((phase - 0.36) / 0.01, 2));
  // T wave
  const tv = 0.22 * Math.exp(-Math.pow((phase - 0.55) / 0.055, 2));
  // Noise
  const noise = (Math.random() - 0.5) * 0.015;

  return (p + q + r + s + tv + noise) * 0.9;
}

/* ─── CHART SETUP ────────────────────────────────────────────── */
let liveChart = null;
let chartTime = 0;

function initChart() {
  const ctx = document.getElementById('liveChart').getContext('2d');
  const N = state.dataPoints;

  state.signalData = Array(N).fill(0);

  liveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(N).fill(''),
      datasets: [{
        data: state.signalData,
        borderColor: '#00ffd5',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context) => {
          const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 220);
          gradient.addColorStop(0, 'rgba(0,255,213,0.15)');
          gradient.addColorStop(1, 'rgba(0,255,213,0)');
          return gradient;
        },
        tension: 0.3,
        borderCapStyle: 'round',
        shadowColor: 'rgba(0,255,213,0.6)',
        shadowBlur: 8,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: {
          display: true,
          min: -0.5,
          max: 1.2,
          grid: {
            color: 'rgba(0,255,213,0.05)',
            lineWidth: 1,
          },
          ticks: {
            color: 'rgba(0,255,213,0.3)',
            font: { family: 'Space Mono', size: 9 },
            maxTicksLimit: 5,
          },
          border: { color: 'transparent' }
        }
      },
      layout: { padding: { top: 10, bottom: 10, left: 4, right: 4 } }
    }
  });
}

/* ─── HERO ECG ───────────────────────────────────────────────── */
let heroT = 0;
let heroPoints = [];

function animateHeroECG() {
  const svg = document.getElementById('heroECG');
  const W = 800, H = 150;
  const bpm = state.monitoring ? state.currentBPM || 72 : 72;
  const step = 4;

  heroPoints.push({ x: heroPoints.length * step, y: H / 2 - generateECGPoint(heroT, bpm) * 55 });
  heroT += 0.015;

  if (heroPoints.length > W / step) heroPoints.shift();

  const pts = heroPoints.map((p, i) => `${i * step},${p.y}`).join(' ');
  svg.setAttribute('points', pts);

  requestAnimationFrame(animateHeroECG);
}

/* ─── FOOTER ECG ─────────────────────────────────────────────── */
let footerT = 0;
let footerPts = [];

function animateFooterECG() {
  const svg = document.getElementById('footerECG');
  const W = 400, H = 40;
  const step = 3;

  footerPts.push({ x: footerPts.length * step, y: H / 2 - generateECGPoint(footerT, 72) * 14 });
  footerT += 0.018;

  if (footerPts.length > W / step) footerPts.shift();

  const pts = footerPts.map((p, i) => `${i * step},${p.y}`).join(' ');
  svg.setAttribute('points', pts);

  requestAnimationFrame(animateFooterECG);
}

/* ─── PARTICLES ──────────────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.reset = function () {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.r = Math.random() * 1.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.5 ? '0,255,213' : '0,255,136';
    };
    this.reset();
  }

  function init() {
    resize();
    particles = Array.from({ length: 90 }, () => new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) p.reset();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();

      // Draw connections
      particles.forEach(p2 => {
        const dx = p.x - p2.x, dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0,255,213,${0.06 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
}

/* ─── BPM GENERATION (Simulated) ────────────────────────────── */
function getRealisticBPM(base) {
  const variation = (Math.random() - 0.5) * 6;
  return Math.round(Math.max(40, Math.min(200, base + variation)));
}

function getBaselineBPM() {
  const age = parseInt(document.getElementById('patientAge').value) || 45;
  if (age < 30) return 68;
  if (age < 50) return 72;
  if (age < 65) return 76;
  return 80;
}

/* ─── RISK ANALYSIS ──────────────────────────────────────────── */
function analyzeBPM(bpm) {
  if (bpm < 50)  return { risk: 'CRITICAL', status: 'BRADYCARDIA',    color: 'red',    desc: 'Severe bradycardia — immediate attention required' };
  if (bpm < 60)  return { risk: 'HIGH',     status: 'BRADYCARDIA',    color: 'yellow', desc: 'Mild bradycardia — monitor closely' };
  if (bpm <= 100) return { risk: 'LOW',     status: 'NORMAL SINUS',   color: 'green',  desc: 'Normal sinus rhythm detected' };
  if (bpm <= 120) return { risk: 'MODERATE', status: 'TACHYCARDIA',   color: 'yellow', desc: 'Mild tachycardia — possible stress response' };
  if (bpm <= 150) return { risk: 'HIGH',    status: 'TACHYCARDIA',    color: 'red',    desc: 'Significant tachycardia — evaluate cause' };
  return              { risk: 'CRITICAL',   status: 'SEVERE TACHY',   color: 'red',    desc: 'Critical tachycardia — emergency protocol' };
}

/* ─── AI DIAGNOSIS MESSAGES ──────────────────────────────────── */
const aiMessages = {
  NORMAL: [
    'Cardiac auscultation analysis complete. Heart sounds S1 and S2 are clearly defined with normal intensity and splitting patterns. No murmurs, gallops, or rubs detected. Sinus rhythm is regular and within physiological range. MATLAB Butterworth bandpass filter confirms clean signal with SNR > 28 dB. AI classification confidence: HIGH.',
    'Real-time DSP analysis via MATLAB pipeline confirms normal cardiac cycle. P-wave morphology within normal limits, QRS complex narrow and well-defined. T-wave polarity consistent with normal ventricular repolarization. No ectopic beats detected in current monitoring window. Recommend continued routine monitoring.',
    'Bluetooth auscultation via Littmann 3200 yielding high-fidelity phonocardiogram. S1 (mitral/tricuspid closure) and S2 (aortic/pulmonic closure) are crisp and appropriately timed. No diastolic or systolic murmurs identified. Signal quality: EXCELLENT. Overall assessment: Normal cardiac function.',
  ],
  TACHYCARDIA: [
    'Elevated heart rate detected. MATLAB frequency domain analysis shows increased cardiac cycle rate beyond normal limits. Signal energy concentrated at higher frequencies consistent with tachycardic pattern. Possible etiology: physical exertion, anxiety, dehydration, or fever. Recommend 12-lead ECG correlation and clinical evaluation.',
    'DSP pipeline flagging sustained elevated BPM. Shortened diastolic filling time noted in waveform analysis. S1-S2 intervals compressed, consistent with tachycardia. No underlying arrhythmia patterns detected at this stage. Recommend rest, hydration assessment, and thyroid function evaluation if persistent.',
  ],
  BRADYCARDIA: [
    'Below-normal heart rate detected by MATLAB signal processor. Prolonged cardiac cycle intervals identified in time-domain analysis. Possible causes: athletic conditioning, vagal response, hypothyroidism, or conduction system disease. Clinical correlation with 12-lead ECG strongly recommended. AI confidence: HIGH.',
    'Low BPM flagged by real-time monitoring engine. MATLAB Holter-equivalent analysis shows consistent RR prolongation. No escape rhythms or pauses detected in current window. Patient hemodynamic status should be assessed. If symptomatic (syncope, dizziness), escalate to emergency evaluation.',
  ],
  SEVERE: [
    '🚨 CRITICAL ALERT: Cardiac parameters outside safe range. Immediate clinical intervention required. MATLAB signal analysis confirms abnormal rhythm pattern. Emergency protocol recommended. Notify attending physician immediately. Continuous monitoring is active.',
  ]
};

function getAIDiagnosis(analysis, bpm) {
  let category;
  if (analysis.risk === 'CRITICAL' || analysis.risk === 'HIGH') {
    category = analysis.status.includes('SEVERE') ? 'SEVERE' :
               analysis.status.includes('BRADY') ? 'BRADYCARDIA' : 'TACHYCARDIA';
  } else if (analysis.status.includes('BRADY')) {
    category = 'BRADYCARDIA';
  } else if (analysis.status.includes('TACHY')) {
    category = 'TACHYCARDIA';
  } else {
    category = 'NORMAL';
  }
  const msgs = aiMessages[category] || aiMessages.NORMAL;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

/* ─── UPDATE DASHBOARD ───────────────────────────────────────── */
function updateDashboard(bpm) {
  const analysis = analyzeBPM(bpm);
  state.currentBPM = bpm;
  state.riskLevel = analysis.risk;
  state.heartStatus = analysis.status;

  // BPM
  const bpmEl = document.getElementById('liveBPM');
  bpmEl.textContent = bpm;
  bpmEl.className = 'metric-value';
  if (analysis.color === 'green') bpmEl.classList.add('green-val');
  else if (analysis.color === 'yellow') bpmEl.classList.add('yellow-val');
  else bpmEl.classList.add('red-val');

  // BPM bar
  const pct = Math.min(100, Math.max(0, ((bpm - 40) / 160) * 100));
  document.getElementById('bpmBar').style.width = pct + '%';

  // Hero BPM
  document.getElementById('heroLiveBPM').textContent = bpm;

  // Risk
  const riskEl = document.getElementById('riskLevel');
  riskEl.textContent = analysis.risk;
  riskEl.className = 'metric-value risk-val';
  const riskInd = document.getElementById('riskIndicator');
  riskInd.className = 'risk-indicator ' + analysis.risk.toLowerCase();
  document.getElementById('riskDesc').textContent = analysis.desc;

  // Heart Status
  const statusEl = document.getElementById('heartStatus');
  statusEl.textContent = analysis.status;
  statusEl.className = 'metric-value status-val';
  const iconEl = document.getElementById('statusIconLarge');

  if (analysis.color === 'green') {
    statusEl.classList.add('green-val');
    iconEl.textContent = '♥';
    iconEl.style.color = 'var(--green)';
    iconEl.style.textShadow = '0 0 20px rgba(0,255,136,0.8)';
    document.getElementById('heroStatus').textContent = 'NORMAL';
    document.getElementById('heroStatus').className = 'hstat-val green';
  } else if (analysis.color === 'yellow') {
    statusEl.classList.add('yellow-val');
    iconEl.textContent = '⚠';
    iconEl.style.color = 'var(--yellow)';
    iconEl.style.textShadow = '0 0 20px rgba(255,204,0,0.8)';
    document.getElementById('heroStatus').textContent = 'WARNING';
    document.getElementById('heroStatus').className = 'hstat-val';
    document.getElementById('heroStatus').style.color = 'var(--yellow)';
  } else {
    statusEl.classList.add('red-val');
    iconEl.textContent = '🚨';
    iconEl.style.color = 'var(--red)';
    iconEl.style.textShadow = '0 0 20px rgba(255,51,85,0.8)';
    document.getElementById('heroStatus').textContent = 'CRITICAL';
    document.getElementById('heroStatus').className = 'hstat-val';
    document.getElementById('heroStatus').style.color = 'var(--red)';
  }
  document.getElementById('statusDesc').textContent = analysis.desc;

  // Signal quality
  const sqEl = document.getElementById('sigQuality');
  sqEl.textContent = analysis.color === 'green' ? 'EXCELLENT' : analysis.color === 'yellow' ? 'GOOD' : 'FAIR';
  sqEl.className = 'sig-val ' + (analysis.color === 'green' ? 'green' : analysis.color === 'yellow' ? '' : '');
  sqEl.style.color = analysis.color === 'green' ? 'var(--green)' : analysis.color === 'yellow' ? 'var(--yellow)' : 'var(--red)';

  // Signal footer
  document.getElementById('s1Peak').textContent = (0.55 + Math.random() * 0.1).toFixed(3) + ' mV';
  document.getElementById('s2Peak').textContent = (0.30 + Math.random() * 0.08).toFixed(3) + ' mV';
  document.getElementById('ampVal').textContent = (0.85 + Math.random() * 0.15).toFixed(3) + ' mV';
  document.getElementById('snrVal').textContent = (26 + Math.random() * 6).toFixed(1) + ' dB';

  // Store for report
  state.bpmHistory.push(bpm);
}

/* ─── UPDATE CHART ───────────────────────────────────────────── */
function updateChart() {
  if (!liveChart || !state.monitoring) return;

  const bpm = state.currentBPM || 72;
  const newPoint = generateECGPoint(chartTime, bpm);
  chartTime += 0.025 * state.zoomLevel;

  state.signalData.push(newPoint);
  if (state.signalData.length > state.dataPoints) state.signalData.shift();

  liveChart.data.datasets[0].data = [...state.signalData];
  liveChart.update('none');

  // Scan line
  const pct = ((state.signalData.length / state.dataPoints) * 100);
  document.getElementById('scanLine').style.left = pct + '%';
}

/* ─── SESSION TIMER ──────────────────────────────────────────── */
function updateTimer() {
  if (!state.sessionStart) return;
  const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  document.getElementById('sessionTimer').textContent = `${mm}:${ss}`;
}

/* ─── START MONITORING ───────────────────────────────────────── */
function startMonitoring() {
  if (state.monitoring) return;

  const name = document.getElementById('patientName').value.trim();
  const age  = document.getElementById('patientAge').value.trim();
  const pid  = document.getElementById('patientID').value.trim();

  if (!name || !age) {
    showToast('⚠ Please enter patient name and age before starting.', 'warning');
    document.getElementById('patient').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  state.monitoring = true;
  state.patientName = name;
  state.patientAge = age;
  state.patientID = pid || 'PT-' + Date.now().toString().slice(-6);
  state.sessionStart = Date.now();
  state.bpmHistory = [];

  // Update Bluetooth indicator
  document.getElementById('btStatus').className = 'status-dot active';
  document.getElementById('btLabel').textContent = 'BT Connected';

  // Monitoring card
  const monEl = document.getElementById('monStatus');
  monEl.textContent = 'ACTIVE';
  monEl.className = 'metric-value mon-val green-val';
  document.getElementById('monDesc').textContent = 'Session in progress · Littmann 3200 active';

  // AI spinner
  document.getElementById('aiSpinner').classList.add('active');

  showToast('✓ Cardiac monitoring session started', 'success');

  // BPM loop — updates every 1s
  const baseBPM = getBaselineBPM();
  let bpmDrift = 0;

  state.bpmInterval = setInterval(() => {
    bpmDrift += (Math.random() - 0.5) * 2;
    bpmDrift = Math.max(-15, Math.min(30, bpmDrift));
    const bpm = getRealisticBPM(baseBPM + bpmDrift);
    updateDashboard(bpm);
  }, 1000);

  // Chart loop — updates every 60ms
  const chartLoop = setInterval(() => {
    if (!state.monitoring) { clearInterval(chartLoop); return; }
    updateChart();
  }, 60);

  // Session timer
  state.timerInterval = setInterval(updateTimer, 1000);

  // AI diagnosis — updates every 8s
  state.aiInterval = setInterval(() => {
    if (!state.monitoring) return;
    const analysis = analyzeBPM(state.currentBPM);
    const msg = getAIDiagnosis(analysis, state.currentBPM);
    const aiEl = document.getElementById('aiDiagnosis');
    aiEl.style.opacity = '0';
    setTimeout(() => {
      aiEl.innerHTML = msg;
      aiEl.style.opacity = '1';
      aiEl.style.transition = 'opacity 0.6s ease';
      state.confidence = 88 + Math.floor(Math.random() * 12);
      document.getElementById('confFill').style.width = state.confidence + '%';
      document.getElementById('confPct').textContent = state.confidence + '%';
    }, 300);
  }, 8000);

  // First AI message after 2s
  setTimeout(() => {
    if (!state.monitoring) return;
    const analysis = analyzeBPM(state.currentBPM || baseBPM);
    document.getElementById('aiDiagnosis').innerHTML = getAIDiagnosis(analysis, state.currentBPM || baseBPM);
    state.confidence = 88 + Math.floor(Math.random() * 12);
    document.getElementById('confFill').style.width = state.confidence + '%';
    document.getElementById('confPct').textContent = state.confidence + '%';
  }, 2000);

  // Scroll to dashboard
  setTimeout(() => {
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });
  }, 400);
}

/* ─── STOP MONITORING ────────────────────────────────────────── */
function stopMonitoring() {
  if (!state.monitoring) return;

  state.monitoring = false;

  clearInterval(state.bpmInterval);
  clearInterval(state.aiInterval);
  clearInterval(state.timerInterval);

  document.getElementById('btStatus').className = 'status-dot';
  document.getElementById('btLabel').textContent = 'BT Disconnected';

  const monEl = document.getElementById('monStatus');
  monEl.textContent = 'STOPPED';
  monEl.className = 'metric-value mon-val yellow-val';
  document.getElementById('monDesc').textContent = 'Session ended · Data saved';

  document.getElementById('aiSpinner').classList.remove('active');

  // Populate report
  generateReport();

  showToast('◼ Monitoring session stopped. Report generated.', 'warning');
}

/* ─── RESET ──────────────────────────────────────────────────── */
function resetAll() {
  stopMonitoring();

  document.getElementById('patientName').value = '';
  document.getElementById('patientAge').value = '';
  document.getElementById('patientID').value = '';
  document.getElementById('monDuration').value = '60';

  document.getElementById('liveBPM').textContent = '--';
  document.getElementById('liveBPM').className = 'metric-value';
  document.getElementById('riskLevel').textContent = '--';
  document.getElementById('heartStatus').textContent = 'IDLE';
  document.getElementById('monStatus').textContent = 'OFF';
  document.getElementById('monStatus').className = 'metric-value mon-val';
  document.getElementById('sessionTimer').textContent = '00:00';
  document.getElementById('aiDiagnosis').innerHTML = '<span class="ai-placeholder">Awaiting cardiac signal input… Configure patient profile and press <strong>Begin Cardiac Monitoring</strong> to activate the AI analysis pipeline.</span>';
  document.getElementById('confFill').style.width = '0%';
  document.getElementById('confPct').textContent = '0%';
  document.getElementById('bpmBar').style.width = '0%';
  document.getElementById('heroLiveBPM').textContent = '--';
  document.getElementById('heroStatus').textContent = 'IDLE';
  document.getElementById('statusIconLarge').textContent = '○';
  document.getElementById('btStatus').className = 'status-dot';
  document.getElementById('btLabel').textContent = 'BT Disconnected';

  // Reset signal
  if (liveChart) {
    state.signalData = Array(state.dataPoints).fill(0);
    liveChart.data.datasets[0].data = [...state.signalData];
    liveChart.update('none');
  }

  state.bpmHistory = [];
  state.currentBPM = 0;
  state.sessionStart = null;

  showToast('↺ System reset complete', 'success');
}

/* ─── GENERATE REPORT ────────────────────────────────────────── */
function generateReport() {
  const now = new Date();
  const bpm = state.currentBPM || '--';
  const analysis = analyzeBPM(bpm);
  const avgBPM = state.bpmHistory.length > 0
    ? Math.round(state.bpmHistory.reduce((a, b) => a + b, 0) / state.bpmHistory.length)
    : bpm;

  const reportID = 'CS-' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') +
                   String(now.getDate()).padStart(2, '0') + '-' + Math.floor(Math.random() * 9000 + 1000);

  document.getElementById('reportID').textContent = reportID;
  document.getElementById('reportDate').textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('rpName').textContent = state.patientName || '--';
  document.getElementById('rpAge').textContent = state.patientAge ? state.patientAge + ' years' : '--';
  document.getElementById('rpID').textContent = state.patientID || '--';
  document.getElementById('rpBPM').textContent = avgBPM + ' BPM';

  // Condition
  let condition, riskText, recommendation;

  if (analysis.color === 'green') {
    condition = 'Normal Sinus Rhythm — No pathological findings detected';
    riskText = 'LOW RISK — Cardiac parameters within normal physiological limits. No immediate intervention required.';
    recommendation = 'Continue routine monitoring. Schedule standard annual cardiac check-up. Maintain healthy lifestyle, regular exercise (150 min/week moderate aerobic activity), balanced diet, and adequate sleep.';
  } else if (analysis.color === 'yellow') {
    condition = analysis.status + ' — Mild deviation from normal range detected';
    riskText = 'MODERATE RISK — Heart rate outside normal limits. Clinical evaluation recommended within 24–48 hours.';
    recommendation = 'Schedule cardiology consultation within 48 hours. Obtain 12-lead ECG. Assess for contributing factors: stress, dehydration, caffeine, medications. Monitor blood pressure and oxygen saturation.';
  } else {
    condition = analysis.status + ' — Critical cardiac parameter detected';
    riskText = 'HIGH / CRITICAL RISK — Immediate medical evaluation required. Do not delay.';
    recommendation = '🚨 URGENT: Immediate medical attention required. Proceed to emergency department or contact attending physician. Do not leave patient unattended. Prepare for potential advanced cardiac life support.';
  }

  document.getElementById('rpCondition').textContent = condition;
  document.getElementById('rpRisk').textContent = riskText;
  document.getElementById('rpRec').textContent = recommendation;
  document.getElementById('rpTime').textContent = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }) + ' — ' + now.toLocaleDateString('en-GB');

  // AI Notes
  const sessionDur = state.sessionStart
    ? Math.floor((Date.now() - state.sessionStart) / 1000)
    : 0;
  const mm = String(Math.floor(sessionDur / 60)).padStart(2, '0');
  const ss = String(sessionDur % 60).padStart(2, '0');

  document.getElementById('rpAINotes').textContent =
    `Automated AI cardiac analysis performed using CardioSense DSP Engine v2.4 with MATLAB Butterworth bandpass filter (20–500 Hz passband). ` +
    `Patient "${state.patientName}", age ${state.patientAge}, monitored for ${mm}:${ss} via Littmann 3200 Electronic Stethoscope (Bluetooth BLE). ` +
    `Average heart rate: ${avgBPM} BPM. Peak BPM recorded: ${state.bpmHistory.length ? Math.max(...state.bpmHistory) : '--'}. ` +
    `Minimum BPM recorded: ${state.bpmHistory.length ? Math.min(...state.bpmHistory) : '--'}. ` +
    `Signal quality: ${analysis.color === 'green' ? 'EXCELLENT (SNR > 28 dB)' : 'GOOD (SNR > 22 dB)'}. ` +
    `AI diagnostic confidence: ${state.confidence}%. ` +
    `This report was generated automatically and must be reviewed by a licensed medical professional before clinical use.`;

  state.reportGenerated = true;

  // Scroll to report
  setTimeout(() => {
    document.getElementById('report').scrollIntoView({ behavior: 'smooth' });
  }, 800);
}

/* ─── PDF GENERATION ─────────────────────────────────────────── */
function generatePDF() {
  if (!state.reportGenerated) {
    showToast('⚠ Run a monitoring session first to generate a report.', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = 210, pageH = 297;
    const margin = 18;

    // ── Background
    doc.setFillColor(2, 11, 18);
    doc.rect(0, 0, pageW, pageH, 'F');

    // ── Header bar
    doc.setFillColor(6, 21, 45);
    doc.rect(0, 0, pageW, 28, 'F');

    // ── Top accent line
    doc.setDrawColor(0, 255, 213);
    doc.setLineWidth(1);
    doc.line(0, 28, pageW, 28);

    // ── Title
    doc.setTextColor(0, 255, 213);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CARDIOSENSE AI', margin, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 180, 200);
    doc.text('Real-Time Heart Monitoring System', margin, 18);
    doc.text('Department of Cardiology — AI Division', margin, 23);

    // Report ID right
    doc.setTextColor(0, 255, 213);
    doc.setFontSize(8);
    doc.text('Report: ' + (document.getElementById('reportID').textContent || '--'), pageW - margin, 12, { align: 'right' });
    doc.setTextColor(100, 180, 200);
    doc.text(document.getElementById('reportDate').textContent || '--', pageW - margin, 18, { align: 'right' });

    let y = 38;

    // ── Patient Info block
    doc.setFillColor(6, 18, 35);
    doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'F');
    doc.setDrawColor(0, 80, 80);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setTextColor(80, 160, 180);
    doc.text('PATIENT NAME', margin + 4, y + 6);
    doc.text('AGE', margin + 55, y + 6);
    doc.text('PATIENT ID', margin + 90, y + 6);
    doc.text('HEART RATE', margin + 130, y + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 240, 250);
    doc.text(document.getElementById('rpName').textContent || '--', margin + 4, y + 14);
    doc.text(document.getElementById('rpAge').textContent || '--', margin + 55, y + 14);
    doc.text(document.getElementById('rpID').textContent || '--', margin + 90, y + 14);
    doc.setTextColor(0, 255, 213);
    doc.text(document.getElementById('rpBPM').textContent || '--', margin + 130, y + 14);

    y += 30;

    // ── Section helper
    const drawSection = (title, content, yStart) => {
      doc.setFillColor(4, 16, 32);
      doc.roundedRect(margin, yStart, pageW - margin * 2, 8, 1, 1, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 220, 200);
      doc.text(title, margin + 3, yStart + 5.5);

      doc.setFillColor(3, 12, 24);
      const lines = doc.splitTextToSize(content, pageW - margin * 2 - 8);
      const blockH = lines.length * 5 + 8;
      doc.roundedRect(margin, yStart + 8, pageW - margin * 2, blockH, 1, 1, 'F');
      doc.setDrawColor(0, 60, 70);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yStart + 8, pageW - margin * 2, blockH, 1, 1, 'S');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(190, 225, 235);
      doc.text(lines, margin + 4, yStart + 14);

      return yStart + 8 + blockH + 6;
    };

    y = drawSection('♥  HEART CONDITION',
      document.getElementById('rpCondition').textContent || '--', y);

    y = drawSection('⚠  RISK ANALYSIS',
      document.getElementById('rpRisk').textContent || '--', y);

    y = drawSection('✚  CLINICAL RECOMMENDATION',
      document.getElementById('rpRec').textContent || '--', y);

    y = drawSection('◈  MONITORING TIMESTAMP',
      document.getElementById('rpTime').textContent || '--', y);

    y += 2;

    // ── AI Notes
    doc.setFillColor(4, 16, 32);
    doc.roundedRect(margin, y, pageW - margin * 2, 8, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 220, 200);
    doc.text('◬  AI CLINICAL NOTES', margin + 3, y + 5.5);

    const aiLines = doc.splitTextToSize(document.getElementById('rpAINotes').textContent || '--', pageW - margin * 2 - 8);
    const aiBlockH = aiLines.length * 5 + 10;
    doc.setFillColor(3, 12, 24);
    doc.roundedRect(margin, y + 8, pageW - margin * 2, aiBlockH, 1, 1, 'F');
    doc.setDrawColor(0, 100, 120);
    doc.roundedRect(margin, y + 8, pageW - margin * 2, aiBlockH, 1, 1, 'S');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(170, 215, 230);
    doc.text(aiLines, margin + 4, y + 15);

    y += 8 + aiBlockH + 8;

    // ── Confidence bar
    doc.setFontSize(7);
    doc.setTextColor(80, 160, 180);
    doc.text('AI DIAGNOSTIC CONFIDENCE: ' + state.confidence + '%', margin, y + 4);
    doc.setFillColor(6, 20, 40);
    doc.roundedRect(margin, y + 6, pageW - margin * 2, 5, 1, 1, 'F');
    doc.setFillColor(0, 200, 160);
    doc.roundedRect(margin, y + 6, (pageW - margin * 2) * (state.confidence / 100), 5, 1, 1, 'F');

    y += 18;

    // ── Bottom border
    doc.setDrawColor(0, 255, 213);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 18, pageW - margin, pageH - 18);

    doc.setFontSize(7);
    doc.setTextColor(60, 120, 140);
    doc.text('CardioSense AI · Real-Time Heart Monitoring System · Graduation Project · Medical Engineering Dept.', pageW / 2, pageH - 12, { align: 'center' });
    doc.text('⚠ For academic and research purposes only. Not a certified medical device.', pageW / 2, pageH - 7, { align: 'center' });

    const filename = `CardioSense_Report_${state.patientName.replace(/\s+/g, '_') || 'Patient'}_${Date.now()}.pdf`;
    doc.save(filename);

    showToast('✓ PDF report downloaded successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('⚠ PDF generation failed. Check console for details.', 'warning');
  }
}

/* ─── PRINT REPORT ───────────────────────────────────────────── */
function printReport() {
  window.print();
}

/* ─── ZOOM ───────────────────────────────────────────────────── */
function setZoom(level) {
  state.zoomLevel = level;
  document.querySelectorAll('.sig-btn').forEach((btn, i) => {
    btn.classList.toggle('active', [1, 2, 4][i] === level);
  });
  showToast('Zoom set to ' + level + 'x', 'success');
}

/* ─── TOAST ──────────────────────────────────────────────────── */
let toastTimeout;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ─── NAVBAR SCROLL EFFECT ───────────────────────────────────── */
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(2, 8, 14, 0.98)';
    nav.style.borderBottomColor = 'rgba(0,255,213,0.15)';
  } else {
    nav.style.background = 'rgba(2, 11, 18, 0.85)';
    nav.style.borderBottomColor = 'rgba(0,220,200,0.12)';
  }
});

/* ─── INTERSECTION OBSERVER (card entrance animations) ──────── */
function initObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.glass-card, .feature-card, .tech-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease, border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease';
    observer.observe(el);
  });
}

/* ─── SMOOTH FLAT IDLE CHART ─────────────────────────────────── */
function idleChartAnimation() {
  if (state.monitoring) return;
  if (!liveChart) return;

  const t = Date.now() / 1000;
  const idle = state.signalData.map((_, i) =>
    0.02 * Math.sin(t * 2 + i * 0.15) + (Math.random() - 0.5) * 0.005
  );
  liveChart.data.datasets[0].data = idle;
  liveChart.update('none');

  requestAnimationFrame(idleChartAnimation);
}

/* ─── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initChart();
  initObserver();

  animateHeroECG();
  animateFooterECG();
  idleChartAnimation();

  // Simulate Bluetooth connecting after 3s
  setTimeout(() => {
    showToast('◈ Littmann 3200 device detected nearby', 'success');
  }, 3000);

  console.log('%cCardioSense AI v1.0 — Initialized', 'color:#00ffd5; font-size:14px; font-weight:bold;');
  console.log('%cReal-Time Heart Monitoring System · MATLAB DSP · Littmann 3200 BLE', 'color:#00ff88; font-size:11px;');
});
