// ==================== ПЕРЕМЕННЫЕ СОСТОЯНИЯ РАЗМЕТКИ ====================
let markupData = [];
let ecgPointSelectionActive = false;
let currentSelectedWaveType = 'P';
let firstPointSelected = false;
let firstPointData = null;
let firstPointElement = null;
let secondPointData = null;
let secondPointElement = null;

// ==================== ФУНКЦИИ ВЫБОРА ТОЧЕК ====================
function initializePointSelection() {
    ecgPointSelectionActive = true;
    firstPointSelected = false;
    firstPointData = firstPointElement = secondPointData = secondPointElement = null;
    document.body.style.cursor = 'crosshair';

    d3.selectAll('.ecg-graph .ecg-point')
        .style('cursor', 'pointer')
        .on('click.point-selection', function (e, d) {
            if (!ecgPointSelectionActive) return;
            e.stopPropagation();
            handlePointClick.call(this, e, d);
        });

    d3.selectAll('.ecg-point-bottom')
        .style('cursor', 'pointer')
        .on('click.point-selection', function (e, d) {
            if (!ecgPointSelectionActive) return;
            e.stopPropagation();
            handlePointClick.call(this, e, d);
        });

    document.addEventListener('keydown', handleKeyPress);
}

function handlePointClick(e, d) {
    if (!firstPointSelected) {
        if (firstPointElement) {
            d3.select(firstPointElement)
                .style('fill', 'transparent')
                .attr('r', 4);
        }

        firstPointElement = this;
        firstPointData = d;
        firstPointSelected = true;

        d3.select(this)
            .style('fill', '#ff0000')
            .attr('r', 3);

        let channel;
        let timeInSeconds;

        if (this.classList.contains('ecg-point-bottom')) {
            channel = fullSignalData.name;
            timeInSeconds = d.index / fullSignalData.samplingRate;
        } else {
            channel = d3.select(this.closest('.ecg-graph'))
                .select('text')
                .text();
            timeInSeconds = d.x / 125;
        }

        let preview = document.getElementById('markupPreview');
        if (!preview) {
            preview = document.getElementById('markupTableBody')
                .appendChild(document.createElement('tr'));
            preview.id = 'markupPreview';
        }

        preview.style.backgroundColor = '#fffacd';
        preview.innerHTML = `
            <td>${currentSelectedWaveType}</td>
            <td>${channel}</td>
            <td>${timeInSeconds.toFixed(3)}</td>
            <td>${d.value.toFixed(4)}</td>
            <td style="color:#888;">ожидание</td>
            <td style="color:#888;">-</td>
            <td>
                <input type="text" id="previewComment" placeholder="Введите комментарий" style="padding:2px;font-size:12px;width:100%;">
                <div style="margin-top:5px;">
                    <button onclick="saveSinglePoint()" style="font-size:10px;padding:2px 5px;background-color:#4CAF50;color:white;border:none;border-radius:2px;">✓</button>
                    <button onclick="cancelPointSelection()" style="font-size:10px;padding:2px 5px;">✗</button>
                </div>
            </td>`;

    } else {
        const isFirstBottom = firstPointElement.classList.contains('ecg-point-bottom');
        const isSecondBottom = this.classList.contains('ecg-point-bottom');

        if (isFirstBottom !== isSecondBottom) {
            return alert('Обе точки должны быть на одном графике');
        }

        if (!isFirstBottom && !isSecondBottom) {
            if (this.closest('.ecg-graph') !== firstPointElement.closest('.ecg-graph')) {
                return alert('Обе точки должны быть в одном отведении');
            }
        }

        if (secondPointElement) {
            d3.select(secondPointElement)
                .style('fill', 'transparent')
                .attr('r', 4);
        }

        secondPointElement = this;
        secondPointData = d;

        d3.select(this)
            .style('fill', '#0066cc')
            .attr('r', 3);

        let channel;
        let time1, time2;

        if (this.classList.contains('ecg-point-bottom')) {
            channel = fullSignalData.name;
            time1 = firstPointData.index / fullSignalData.samplingRate;
            time2 = d.index / fullSignalData.samplingRate;
        } else {
            channel = d3.select(this.closest('.ecg-graph'))
                .select('text')
                .text();
            time1 = firstPointData.x / 125;
            time2 = d.x / 125;
        }

        markupData.push({
            type: currentSelectedWaveType,
            lead: channel,
            time1: +time1.toFixed(3),
            value1: +firstPointData.value.toFixed(4),
            time2: +time2.toFixed(3),
            value2: +secondPointData.value.toFixed(4),
            comment: document.getElementById('previewComment')?.value || ''
        });

        updateMarkupTable();
        clearSelection();
    }
}

function handleKeyPress(e) {
    if (e.key === 'Escape' && ecgPointSelectionActive)
        clearSelection();
    else if (e.key === 'Enter' && firstPointSelected && !secondPointData) {
        const isBottom = firstPointElement.classList.contains('ecg-point-bottom');

        let channel;
        let time1;

        if (isBottom) {
            channel = fullSignalData.name;
            time1 = firstPointData.index / fullSignalData.samplingRate;
        } else {
            channel = d3.select(firstPointElement.closest('.ecg-graph'))
                .select('text')
                .text();
            time1 = firstPointData.x / 125;
        }

        markupData.push({
            type: currentSelectedWaveType,
            lead: channel,
            time1: +time1.toFixed(3),
            value1: +firstPointData.value.toFixed(4),
            time2: 0,
            value2: 0,
            comment: (document.getElementById('previewComment')?.value || '') + ' (только одна точка)'
        });

        updateMarkupTable();
        clearSelection();
    }
}

function clearSelection() {
    d3.selectAll('.ecg-point, .ecg-point-bottom')
        .style('fill', 'transparent')
        .attr('r', 4)
        .style('stroke', 'none')
        .style('stroke-width', '0');

    ecgPointSelectionActive = firstPointSelected = false;
    firstPointData = firstPointElement = secondPointData = secondPointElement = null;
    document.body.style.cursor = '';

    d3.selectAll('.ecg-point, .ecg-point-bottom')
        .on('click.point-selection', null)
        .style('cursor', '');

    document.removeEventListener('keydown', handleKeyPress);
    document.getElementById('markupPreview')?.remove();
    document.getElementById('markupModeToggle').checked = false;
}

function cancelPointSelection() {
    clearSelection();
}

function saveSinglePoint() {
    if (!firstPointSelected || !firstPointData) return;

    const isBottom = firstPointElement.classList.contains('ecg-point-bottom');

    let channel;
    let time1;

    if (isBottom) {
        channel = fullSignalData.name;
        time1 = firstPointData.index / fullSignalData.samplingRate;
    } else {
        channel = d3.select(firstPointElement.closest('.ecg-graph'))
            .select('text')
            .text();
        time1 = firstPointData.x / 125;
    }

    markupData.push({
        type: currentSelectedWaveType,
        lead: channel,
        time1: +time1.toFixed(3),
        value1: +firstPointData.value.toFixed(4),
        time2: 0,
        value2: 0,
        comment: (document.getElementById('previewComment')?.value || '') + ' (только одна точка)'
    });

    updateMarkupTable();
    clearSelection();
}

// ==================== ФУНКЦИИ ТАБЛИЦЫ РАЗМЕТКИ ====================
function updateMarkupTable() {
    const tb = document.getElementById('markupTableBody');

    clearHighlightedPoints();

    tb.innerHTML = !markupData.length ?
        '<tr><td colspan="7" class="empty-markup">Нет данных о разметке</td></tr>' :
        markupData.map((item, index) =>
            `<tr class="markup-row" data-markup-index="${index}" style="cursor: pointer;">
                <td>${item.type || ''}</td>
                <td>${item.lead || ''}</td>
                <td>${item.time1?.toFixed(3) || ''}</td>
                <td>${item.value1?.toFixed(4) || ''}</td>
                <td>${item.time2?.toFixed(3) || ''}</td>
                <td>${item.value2?.toFixed(4) || ''}</td>
                <td>${item.comment || ''}</td>
            </tr>`
        ).join('');

    document.querySelectorAll('.markup-row').forEach(row => {
        row.addEventListener('click', function (e) {
            const index = this.dataset.markupIndex;
            highlightMarkupPoints(parseInt(index));

            document.querySelectorAll('.markup-row').forEach(r =>
                r.classList.remove('selected-markup-row'));
            this.classList.add('selected-markup-row');
        });
    });

    document.getElementById('markupModeToggle').checked = false;
}

// ==================== ФУНКЦИИ ПОДСВЕТКИ ТОЧЕК ====================
function clearHighlightedPoints() {
    d3.selectAll('.ecg-graph .ecg-point')
        .style('fill', 'transparent')
        .attr('r', 4)
        .style('stroke', null)
        .style('stroke-width', null);

    d3.selectAll('.ecg-point-bottom')
        .style('fill', 'transparent')
        .attr('r', 4)
        .style('stroke', null)
        .style('stroke-width', null);

    d3.selectAll('.ecg-line')
        .style('stroke', '#2c6fbb')
        .style('stroke-width', LINE_WIDTH);
}

function highlightMarkupPoints(index) {
    if (!markupData[index] || !fullEcgData) return;

    const markup = markupData[index];

    clearHighlightedPoints();

    const isBottomLead = markup.lead === fullSignalData?.name;

    if (isBottomLead) {
        highlightPointsOnBottomGraph(markup);
    } else {
        highlightPointsOnTopGraphs(markup);
    }
}

function highlightPointsOnBottomGraph(markup) {
    if (!fullSignalData) return;

    const samplingRate = fullSignalData.samplingRate;

    const index1 = Math.round(markup.time1 * samplingRate);
    const index2 = markup.time2 > 0 ? Math.round(markup.time2 * samplingRate) : null;

    d3.selectAll('.ecg-point-bottom')
        .filter(d => Math.abs(d.index - index1) === 0)
        .style('fill', '#ff0000')
        .attr('r', 6)
        .style('stroke', '#ffffff')
        .style('stroke-width', '2px');

    if (index2 !== null) {
        d3.selectAll('.ecg-point-bottom')
            .filter(d => Math.abs(d.index - index2) === 0)
            .style('fill', '#0066cc')
            .attr('r', 6)
            .style('stroke', '#ffffff')
            .style('stroke-width', '2px');
    }

    if (index2 !== null) {
        highlightLineBetweenPoints(index1, index2, true);
    }
}

function highlightPointsOnTopGraphs(markup) {
    const channelIndex = fullEcgData.channelNames.findIndex(name => name === markup.lead);
    if (channelIndex === -1) return;

    const containerId = channelIndex < 6 ? 'standard-leads' : 'chest-leads';
    const graphIndex = channelIndex < 6 ? channelIndex : channelIndex - 6;

    const container = document.getElementById(containerId);
    if (!container) return;

    const graphs = container.querySelectorAll('.ecg-graph');
    if (graphIndex >= graphs.length) return;

    const targetGraph = graphs[graphIndex];

    const x1 = markup.time1 * 125;
    const x2 = markup.time2 > 0 ? markup.time2 * 125 : null;

    const points = d3.select(targetGraph).selectAll('.ecg-point').data();

    const findPointByX = (targetX) => {
        let closestPoint = null;
        let minDiff = Infinity;

        points.forEach(point => {
            const diff = Math.abs(point.x - targetX);
            if (diff < minDiff && diff < 2) {
                minDiff = diff;
                closestPoint = point;
            }
        });

        return closestPoint;
    };

    const point1 = findPointByX(x1);
    if (point1) {
        d3.select(targetGraph).selectAll('.ecg-point')
            .filter(d => d === point1)
            .style('fill', '#ff0000')
            .attr('r', 6)
            .style('stroke', '#ffffff')
            .style('stroke-width', '2px');
    }

    let point2 = null;
    if (x2 !== null) {
        point2 = findPointByX(x2);
        if (point2) {
            d3.select(targetGraph).selectAll('.ecg-point')
                .filter(d => d === point2)
                .style('fill', '#0066cc')
                .attr('r', 6)
                .style('stroke', '#ffffff')
                .style('stroke-width', '2px');
        }
    }

    if (x2 !== null && point1 && point2) {
        highlightLineBetweenPoints(point1.x, point2.x, false, targetGraph);
    }
}

function highlightLineBetweenPoints(pos1, pos2, isBottom, targetGraph = null) {
    d3.selectAll('.ecg-line-highlight').remove();

    if (isBottom) {
        const bottomSvg = d3.select('#bottom-lead svg');
        const line = bottomSvg.select('.ecg-line');
        const lineData = line.datum();

        if (lineData && lineData.length > 0) {
            const startIdx = Math.min(pos1, pos2);
            const endIdx = Math.max(pos1, pos2);

            const highlightedSection = lineData.filter(d =>
                d.index >= startIdx && d.index <= endIdx
            );

            if (highlightedSection.length > 0) {
                bottomSvg.select('g')
                    .append('path')
                    .datum(highlightedSection)
                    .attr('class', 'ecg-line-highlight')
                    .attr('d', d3.line()
                        .x(d => d.x)
                        .y(d => d.y)
                        .curve(d3.curveMonotoneX))
                    .attr('fill', 'none')
                    .attr('stroke', '#ffaa00')
                    .attr('stroke-width', LINE_WIDTH + 2)
                    .attr('stroke-dasharray', '5,3');
            }
        }
    } else if (targetGraph) {
        const line = d3.select(targetGraph).select('.ecg-line');
        const lineData = line.datum();

        if (lineData && lineData.length > 0) {
            const startX = Math.min(pos1, pos2);
            const endX = Math.max(pos1, pos2);

            const highlightedSection = lineData.filter(d =>
                d.x >= startX && d.x <= endX
            );

            if (highlightedSection.length > 0) {
                let lineGroup = d3.select(targetGraph).select('.ecg-line-group');
                if (lineGroup.empty()) {
                    lineGroup = d3.select(targetGraph).append('g')
                        .attr('class', 'ecg-line-group');
                }

                lineGroup.append('path')
                    .datum(highlightedSection)
                    .attr('class', 'ecg-line-highlight')
                    .attr('d', d3.line()
                        .x(d => d.x)
                        .y(d => d.y)
                        .curve(d3.curveMonotoneX))
                    .attr('fill', 'none')
                    .attr('stroke', '#ffaa00')
                    .attr('stroke-width', LINE_WIDTH + 2)
                    .attr('stroke-dasharray', '5,3');
            }
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    .markup-row:hover {
        background-color: #f0f8ff;
    }
    .markup-row.selected-markup-row {
        background-color: #e6f3ff;
        border-left: 3px solid #2c6fbb;
    }
    .ecg-line-highlight {
        pointer-events: none;
        animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
        0% { stroke-opacity: 0.8; }
        50% { stroke-opacity: 0.4; }
        100% { stroke-opacity: 0.8; }
    }
`;
document.head.appendChild(style);

// ==================== СОХРАНЕНИЕ РАЗМЕТОК ====================
async function saveAllMarkupPoints() {
    if (!markupData || markupData.length === 0) {
        alert('Нет точек для сохранения');
        return;
    }

    if (!currentRecord?.recordId) {
        alert('Не выбрана запись ЭКГ');
        return;
    }

    const saveBtn = document.getElementById('saveMarkupBtn');
    const statusEl = document.getElementById('saveMarkupStatus');

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        statusEl.textContent = 'Создание разметки...';

        const createResponse = await authService.apiRequest(
            `http://localhost:5104/api/MarkupJson/create-for-record/${currentRecord.recordId}`,
            { method: 'POST' }
        );

        if (!createResponse.ok) {
            throw new Error('Не удалось создать разметку');
        }

        const createResult = await createResponse.json();
        const markupId = createResult.markupId;

        statusEl.textContent = `Разметка #${markupId} создана, подготавливаем JSON...`;

        const markupJson = {
            recordId: currentRecord.recordId,
            recordInfo: {
                id: currentRecord.recordId,
                type: currentRecord.type,
                typeName: getSignalType(currentRecord.type),
                samplingRate: currentRecord.samplingRate,
                uploadedAt: currentRecord.uploadedAt
            },
            createdAt: new Date().toISOString(),
            createdBy: {
                doctorId: currentDoctorId,
                doctorName: document.getElementById('doctorName')?.textContent || 'Unknown'
            },
            points: markupData.map((point, index) => ({
                id: index + 1,
                type: point.type || 'P',
                lead: point.lead || 'Unknown',
                time1: point.time1 || 0,
                value1: point.value1 || 0,
                time2: point.time2 || 0,
                value2: point.value2 || 0,
                comment: point.comment || '',
                timestamp: new Date().toISOString()
            })),
            metadata: {
                totalPoints: markupData.length,
                version: '1.0',
                source: 'ECG Viewer'
            }
        };

        statusEl.textContent = 'Загружаем JSON в MinIO...';

        const formData = new FormData();
        const blob = new Blob([JSON.stringify(markupJson)], { type: 'application/json' });
        formData.append('file', blob, `markup_${markupId}.json`);

        const uploadResponse = await authService.apiRequest(
            `http://localhost:5104/api/MarkupJson/upload/${markupId}`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!uploadResponse.ok) {
            throw new Error('Не удалось загрузить JSON');
        }

        const uploadResult = await uploadResponse.json();

        console.log('Разметка сохранена:', {
            markupId,
            objectName: uploadResult.objectName,
            fileSize: uploadResult.fileSize,
            points: markupData.length
        });

        if (confirm(`Разметка #${markupId} сохранена (${markupData.length} точек). Очистить таблицу?`)) {
            markupData = [];
            updateMarkupTable();
            statusEl.textContent = 'Готово. Таблица очищена';
        }

    } catch (error) {
        console.error('Ошибка:', error);
        statusEl.textContent = 'Ошибка сохранения';
        alert('Ошибка при сохранении разметки: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить все';
    }
}
window.saveAllMarkupPoints = saveAllMarkupPoints;

// ==================== ЗАГРУЗКА РАЗМЕТОК ====================
async function loadRecordMarkups(recordId) {
    if (!recordId) {
        document.getElementById('markupsList').innerHTML = '<div class="no-data">Выберите запись</div>';
        return;
    }

    try {
        const response = await authService.apiRequest(
            `http://localhost:5104/api/MarkupJson/record-markups/${recordId}`
        );

        if (!response.ok) {
            throw new Error('Не удалось загрузить разметки');
        }

        const data = await response.json();
        displayMarkupsList(data.markups);

    } catch (error) {
        console.error('Ошибка загрузки разметок:', error);
        document.getElementById('markupsList').innerHTML =
            '<div class="no-data error">Ошибка загрузки</div>';
    }
}

function displayMarkupsList(markups) {
    const container = document.getElementById('markupsList');

    if (!markups || markups.length === 0) {
        container.innerHTML = '<div class="no-data">Нет разметок для этой записи</div>';
        return;
    }

    container.innerHTML = markups.map(m => `
        <div class="markup-card" id="markup-${m.idMarkup}" onclick="loadMarkupPoints(${m.idMarkup})">
            <div class="markup-header">
                <span>Разметка #${m.idMarkup}</span>
                <span class="markup-badge">${formatFileSize(m.markupFileSize || 0)}</span>
            </div>
            <div class="markup-meta">
                <span>📅 ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</span>
                <span>📄 ${m.markupOriginalFileName || 'без имени'}</span>
            </div>
            <div class="markup-preview">
                <span class="markup-date">${new Date(m.createdAt).toLocaleString('ru-RU')}</span>
            </div>
        </div>
    `).join('');
}

function selectMarkup(markupId) {
    document.querySelectorAll('.markup-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`markup-${markupId}`)?.classList.add('active');
}

async function loadMarkupPoints(markupId) {
    try {
        const card = document.getElementById(`markup-${markupId}`);
        if (card) {
            card.style.opacity = '0.7';
            card.style.pointerEvents = 'none';
        }

        const response = await authService.apiRequest(
            `http://localhost:5104/api/MarkupJson/download/${markupId}`
        );

        if (!response.ok) throw new Error('Не удалось загрузить разметку');

        const jsonContent = await response.text();
        const markupData_ = JSON.parse(jsonContent);

        markupData = [];

        if (markupData_.points && Array.isArray(markupData_.points)) {
            markupData = markupData_.points.map(p => ({
                type: p.type || p.waveType || 'P',
                lead: p.lead || 'Unknown',
                time1: p.time1 || 0,
                value1: p.value1 || p.value || 0,
                time2: p.time2 || 0,
                value2: p.value2 || 0,
                comment: p.comment || ''
            }));
        }

        updateMarkupTable();

        selectMarkup(markupId);

        console.log(`Загружено ${markupData.length} точек разметки`);

        const tableContainer = document.querySelector('.markup-table-container');
        if (tableContainer) {
            tableContainer.style.transition = 'background 0.5s';
            tableContainer.style.background = '#e8f5e8';
            setTimeout(() => {
                tableContainer.style.background = '';
            }, 500);
        }

    } catch (error) {
        console.error('Ошибка загрузки точек:', error);
        alert('Не удалось загрузить точки разметки');
    } finally {
        const card = document.getElementById(`markup-${markupId}`);
        if (card) {
            card.style.opacity = '';
            card.style.pointerEvents = '';
        }
    }
}

if (confirm(`Разметка #${markupId} сохранена (${markupData.length} точек). Очистить таблицу?`)) {
    markupData = [];
    updateMarkupTable();
    statusEl.textContent = 'Готово. Таблица очищена';
}

async function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        markupData = [];
        updateMarkupTable();
        currentRecord = null;
        fullEcgData = null;
        fullSignalData = null;
        selectedChannelIndex = null;

        await authService.logout();
    }
}

// ==================== УДАЛЕНИЕ ЗАПИСЕЙ И РАЗМЕТОК ====================
async function deleteRecord(recordId, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!confirm('Вы уверены, что хотите удалить эту запись? Все связанные разметки также будут удалены.')) {
        return;
    }

    const recordCard = document.getElementById(`record-${recordId}`);
    const originalContent = recordCard.innerHTML;

    try {
        recordCard.style.opacity = '0.5';
        recordCard.style.pointerEvents = 'none';
        recordCard.innerHTML = '<div style="text-align:center;padding:20px;">Удаление...</div>';

        const response = await authService.apiRequest(
            `http://localhost:5104/api/NpyFiles/delete/${recordId}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            throw new Error('Не удалось удалить запись');
        }

        const recordElement = document.getElementById(`record-${recordId}`);
        if (recordElement) {
            recordElement.remove();
        }

        if (currentRecord?.recordId === recordId) {
            markupData = [];
            updateMarkupTable();
            currentRecord = null;
            fullEcgData = null;
            fullSignalData = null;
            selectedChannelIndex = null;

            document.getElementById('paramsData').innerHTML = '';
            clearBottomGraph();

            document.getElementById('markupsList').innerHTML = '<div class="no-data">Выберите запись</div>';
        }

        showNotification('Запись успешно удалена', 'success');

    } catch (error) {
        console.error('Ошибка удаления записи:', error);

        recordCard.style.opacity = '';
        recordCard.style.pointerEvents = '';
        recordCard.innerHTML = originalContent;

        showNotification('Ошибка при удалении записи: ' + error.message, 'error');
    }
}

async function deleteMarkup(markupId, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!confirm('Вы уверены, что хотите удалить эту разметку?')) {
        return;
    }

    const markupCard = document.getElementById(`markup-${markupId}`);
    const originalContent = markupCard.innerHTML;

    try {
        markupCard.style.opacity = '0.5';
        markupCard.style.pointerEvents = 'none';
        markupCard.innerHTML = '<div style="text-align:center;padding:10px;">Удаление...</div>';

        const response = await authService.apiRequest(
            `http://localhost:5104/api/MarkupJson/delete/${markupId}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            throw new Error('Не удалось удалить разметку');
        }

        const markupElement = document.getElementById(`markup-${markupId}`);
        if (markupElement) {
            markupElement.remove();
        }

        const markupsList = document.getElementById('markupsList');
        if (markupsList.children.length === 0) {
            markupsList.innerHTML = '<div class="no-data">Нет разметок для этой записи</div>';
        }

        showNotification('Разметка успешно удалена', 'success');

    } catch (error) {
        console.error('Ошибка удаления разметки:', error);

        markupCard.style.opacity = '';
        markupCard.style.pointerEvents = '';
        markupCard.innerHTML = originalContent;

        showNotification('Ошибка при удалении разметки: ' + error.message, 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(notification);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function displayMarkupsList(markups) {
    const container = document.getElementById('markupsList');

    if (!markups || markups.length === 0) {
        container.innerHTML = '<div class="no-data">Нет разметок для этой записи</div>';
        return;
    }

    container.innerHTML = markups.map(m => `
        <div class="markup-card" id="markup-${m.idMarkup}">
            <div class="markup-header" onclick="loadMarkupPoints(${m.idMarkup})" style="cursor: pointer;">
                <span>Разметка #${m.idMarkup}</span>
                <span class="markup-badge">${formatFileSize(m.markupFileSize || 0)}</span>
            </div>
            <div class="markup-meta" onclick="loadMarkupPoints(${m.idMarkup})" style="cursor: pointer;">
                <span>📅 ${new Date(m.createdAt).toLocaleDateString('ru-RU')}</span>
                <span>📄 ${m.markupOriginalFileName || 'без имени'}</span>
            </div>
            <div class="markup-actions" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span class="markup-date">${new Date(m.createdAt).toLocaleString('ru-RU')}</span>
                <button class="delete-markup-btn" onclick="deleteMarkup(${m.idMarkup}, event)" 
                        style="background-color: #f44336; color: white; border: none; border-radius: 3px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
                    Удалить
                </button>
            </div>
        </div>
    `).join('');
}

async function loadDoctorRecords() {
    try {
        console.log('loadDoctorRecords started');

        if (!currentDoctorId) {
            console.log('No currentDoctorId, getting from auth');
            const u = await authService.getCurrentUser();
            console.log('Auth user:', u);

            if (u?.idDoctor) {
                currentDoctorId = u.idDoctor;
                console.log('Set currentDoctorId:', currentDoctorId);
            } else {
                console.error('No doctor ID in auth response');
                return showError('Не удалось загрузить данные врача');
            }
        }

        console.log('Fetching records for doctor:', currentDoctorId);
        console.log('Request URL:', `${baseUrl}/doctor-records/${currentDoctorId}`);

        const r = await authService.apiRequest(`${baseUrl}/doctor-records/${currentDoctorId}`);
        console.log('Response status:', r?.status);

        if (!r?.ok) {
            console.error('Response not OK:', r?.status, r?.statusText);
            return showError('Не удалось загрузить список записей');
        }

        const records = await r.json();
        console.log('Records received:', records);

        const list = document.getElementById('recordsList');
        if (!list) {
            console.error('recordsList element not found');
            return;
        }

        if (!records?.length) {
            console.log('No records found');
            list.innerHTML = '<div class="no-data">Записей не найдено</div>';
            return;
        }

        list.innerHTML = records.map(r => {
            console.log('Processing record:', r);
            return `
                <div class="record-card" id="record-${r.recordId}">
                    <div class="record-header" onclick="loadRecord(${r.recordId})" style="cursor: pointer;">
                        ЭКГ #${r.recordId}
                        <button class="delete-record-btn" onclick="deleteRecord(${r.recordId}, event)" 
                                style="background-color: #f44336; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 10px; margin-left: 10px;">
                            Удалить
                        </button>
                    </div>
                    <div class="record-meta" onclick="loadRecord(${r.recordId})" style="cursor: pointer;">
                        ${new Date(r.uploadedAt).toLocaleDateString('ru-RU')} ${new Date(r.uploadedAt).toLocaleTimeString('ru-RU')}
                    </div>
                    <div class="record-meta" onclick="loadRecord(${r.recordId})" style="cursor: pointer;">
                        ${formatFileSize(r.fileSize)}
                    </div>
                </div>
            `;
        }).join('');

        console.log('Records list updated successfully');

    } catch (error) {
        console.error('ERROR in loadDoctorRecords:', error);
        console.error('Error stack:', error.stack);
        showError('Ошибка при загрузке списка записей: ' + error.message);
    }
}

async function loadRecord(recordId) {
    try {
        console.log('Loading record:', recordId);

        destroyZoomHandlers();
        currentZoomState = null;

        clearBottomGraph();

        markupData = [];
        updateMarkupTable();

        const r = await authService.apiRequest(`${baseUrl}/info/${recordId}`);
        if (!r?.ok) return;

        currentRecord = await r.json();
        document.getElementById('paramsData').innerHTML = `
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">ID записи</div>
                    <div class="param-value">${currentRecord.recordId}</div>
                </div>
            </div>
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">Частота дискретизации</div>
                    <div class="param-value">${currentRecord.samplingRate} Гц</div>
                </div>
            </div>
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">Тип сигнала</div>
                    <div class="param-value">${getSignalType(currentRecord.type)}</div>
                </div>
            </div>`;

        document.querySelectorAll('.record-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`record-${recordId}`)?.classList.add('active');

        await loadParsedEcgData(recordId);
        await loadRecordMarkups(recordId);

    } catch (error) {
        showError('Ошибка при загрузке записи: ' + error.message);
    }
}

async function loadParsedEcgData(recordId) {
    try {
        console.log('Loading parsed ECG data for record:', recordId);

        const r = await authService.apiRequest(`${baseUrl}/ecg-data/${recordId}`);
        if (!r?.ok) return showError('Failed to load ECG data');

        const d = JSON.parse(await r.text());
        if (!d.channels) return showError('Данные каналов не получены');

        fullEcgData = {
            channels: d.channels,
            channelNames: d.channelNames,
            samplingRate: 500
        };

        createEcgGrids();

        setTimeout(() => {
            displayAllChannelsD3();
            initZoomHandlers();
        }, 100);

        const sel = document.getElementById('fullSignalChannelSelect');
        if (!sel) return;

        sel.innerHTML = '<option value="">-- Выберите канал --</option>' +
            (fullEcgData.channelNames
                ?.map((n, i) => `<option value="${i}">${n}</option>`)
                .join('') || '');

        sel.onchange = e => {
            if (!e.target.value) {
                clearBottomGraph();
                return;
            }

            selectedChannelIndex = +e.target.value;
            fullSignalData = {
                data: fullEcgData.channels[selectedChannelIndex],
                name: fullEcgData.channelNames[selectedChannelIndex],
                samplingRate: fullEcgData.samplingRate,
                totalDuration: fullEcgData.channels[selectedChannelIndex].length / fullEcgData.samplingRate
            };

            displayBottomGraph();
        };

    } catch (error) {
        showError('Ошибка загрузки ЭКГ: ' + error.message);
    }
}

// ==================== ЗАГРУЗКА ФАЙЛОВ ====================
async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    if (!currentDoctorId) {
        alert('Сначала необходимо авторизоваться');
        return;
    }

    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Загрузка...';
    uploadBtn.disabled = true;

    let successCount = 0;
    let errorCount = 0;

    for (let file of files) {
        try {
            const createResponse = await authService.apiRequest(
                'http://localhost:5104/api/npyfiles/create-record',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        idDoctor: currentDoctorId,
                        rc: 0,
                        type: 1
                    })
                }
            );

            if (!createResponse.ok) {
                throw new Error(`Ошибка создания записи для файла ${file.name}`);
            }

            const createResult = await createResponse.json();
            const recordId = createResult.recordId;

            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await authService.apiRequest(
                `http://localhost:5104/api/npyfiles/upload/${recordId}`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (uploadResponse.ok) {
                successCount++;
                console.log(`Файл ${file.name} успешно загружен как запись #${recordId}`);
            } else {
                errorCount++;
                console.error(`Ошибка загрузки файла ${file.name}`);
            }

        } catch (error) {
            errorCount++;
            console.error(`Ошибка при обработке файла ${file.name}:`, error);
        }
    }

    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;

    alert(`Загружено: ${successCount} файлов\nОшибок: ${errorCount}`);

    if (successCount > 0) {
        await loadDoctorRecords();
    }
}

// ==================== ВЫХОД ====================
async function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?'))
        await authService.logout();
}