// ==================== ОБЩИЕ УТИЛИТЫ ====================
/*const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let order = 0, len = bytes;
    while (len >= 1024 && order < 3) {
        order++;
        len /= 1024;
    }
    return `${len.toFixed(2)} ${sizes[order]}`;
};

const getSignalType = type => ({
    1: 'ЭКГ',
    2: 'ММГ',
    3: 'ЭЭГ'
}[type] || `Тип ${type}`);

const showError = msg => alert('Ошибка: ' + msg);

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentDoctorId = null;
let currentRecord = null;
let fullEcgData = null;
let fullSignalData = null;
let selectedChannelIndex = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    await loadDoctorRecords();
    setTimeout(createEcgGrids, 500);

    document.querySelectorAll('input[name="wave-type"]')
        .forEach(s => s.addEventListener('change', function () {
            if (this.checked)
                currentSelectedWaveType = this.value;
        }));

    document.getElementById('markupModeToggle')
        ?.addEventListener('change', function () {
            this.checked ? initializePointSelection() : cancelPointSelection();
        });
});

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================
window.loadRecord = loadRecord;
window.loadDoctorRecords = loadDoctorRecords;
window.handleLogout = handleLogout;
window.loadRecordMarkups = loadRecordMarkups;
window.selectMarkup = selectMarkup;
window.downloadMarkup = downloadMarkup;
window.loadMarkupPoints = loadMarkupPoints;
window.saveAllMarkupPoints = saveAllMarkupPoints;
window.cancelPointSelection = cancelPointSelection;
window.saveSinglePoint = saveSinglePoint;
window.destroyZoomHandlers = destroyZoomHandlers;*/
