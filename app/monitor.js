const { exec } = require('child_process');
const axios = require('axios');

// Ganti dengan URL broker Anda
const BROKER_URL = 'http://192.168.56.10:8080/cpu-usage-report';
const HOST_ID = process.env.HOST_ID || 'host-1';

// Ambil CPU usage dari semua container Docker yang aktif
function getAverageCPU(callback) {
  const cmd = 'sudo docker stats --no-stream --format "{{.Name}},{{.CPUPerc}}"';

  exec(cmd, (err, stdout) => {
    if (err) return callback(err, null);

    const lines = stdout.trim().split('\n');
    const cpuValues = lines
      .map(line => line.split(',')[1])
      .map(str => parseFloat(str.replace('%', '')))
      .filter(n => !isNaN(n));

    const avgCpu = cpuValues.length > 0
      ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length
      : 0;

    callback(null, avgCpu);
  });
}

// Kirim data ke broker
function sendCpuUsage() {
  getAverageCPU((err, avgCpu) => {
    if (err) {
      console.error('❌ Gagal mendapatkan CPU usage:', err.message);
      return;
    }

    axios.post(BROKER_URL, {
      host: HOST_ID,
      avgCpu: avgCpu
    }).then(() => {
      console.log(`📤 CPU usage terkirim dari ${HOST_ID}: ${avgCpu.toFixed(2)}%`);
    }).catch(err => {
      console.error('❌ Gagal mengirim ke broker:', err.message);
    });
  });
}

// Jalankan setiap 1 detik
setInterval(sendCpuUsage, 1000);

console.log(`📡 Monitor CPU aktif untuk ${HOST_ID}...`);