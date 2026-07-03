let markupData = [];
let ecgPointSelectionActive = false;
let currentSelectedWaveType = 'P';
let firstPointSelected = false;
let firstPointData = null;
let firstPointElement = null;
let secondPointData = null;
let secondPointElement = null;

let currentTooltip = null;           // текущий открытый тултип (DOM элемент)
let currentTooltipMarkupIndex = null; // индекс разметки, к которой привязан тултип

const API_BASE_URL = '/api';
let currentDoctorId = null;
let currentRecord = null;
let fullEcgData = null;
let fullSignalData = null;
let selectedChannelIndex = null;

function showModal({ message, type = 'alert', autoClose = null }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal-window';

        const closeBtn = document.createElement('div');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => {
            cleanup();
            if (type === 'confirm') resolve(false);
            else resolve();
        });
        modal.appendChild(closeBtn);

        const msgDiv = document.createElement('div');
        msgDiv.className = 'modal-message';
        msgDiv.textContent = message;
        modal.appendChild(msgDiv);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'modal-buttons';

        const cleanup = () => {
            overlay.remove();
        };

        if (type === 'confirm') {
            const okBtn = document.createElement('button');
            okBtn.className = 'modal-btn modal-btn-ok';
            okBtn.textContent = 'ОК';
            okBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            buttonsDiv.appendChild(okBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn modal-btn-cancel';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            buttonsDiv.appendChild(cancelBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.className = 'modal-btn modal-btn-ok';
            okBtn.textContent = 'ОК';
            okBtn.addEventListener('click', () => {
                cleanup();
                resolve();
            });
            buttonsDiv.appendChild(okBtn);
        }

        modal.appendChild(buttonsDiv);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (type === 'toast' && autoClose) {
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    cleanup();
                    resolve();
                }
            }, autoClose);
        }
    });
}

async function customAlert(message) {
    await showModal({ message, type: 'alert' });
}

async function customConfirm(message) {
    return await showModal({ message, type: 'confirm' });
}

async function customToast(message, duration = 2000) {
    await showModal({ message, type: 'toast', autoClose: duration });
}

const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let order = 0;
    let len = bytes;
    while (len >= 1024 && order < 3) {
        order++;
        len /= 1024;
    }
    return `${len.toFixed(2)} ${sizes[order]}`;
};

const getSignalType = type => {
    const types = { 1: 'ЭКГ', 2: 'ММГ', 3: 'ЭЭГ' };
    return types[type] || `Тип ${type}`;
};

function formatDateTimeForTitle(dateString) {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}${month}${year}_${hours}${minutes}`;
}

function formatReadableDateTime(dateString) {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function initializePointSelection() {
    ecgPointSelectionActive = true;
    firstPointSelected = false;
    firstPointData = firstPointElement = secondPointData = secondPointElement = null;
    document.body.style.cursor = 'crosshair';

    d3.selectAll('.ecg-graph .ecg-point, .ecg-point-bottom')
        .style('cursor', 'pointer')
        .on('click.point-selection', function (e, d) {
            if (!ecgPointSelectionActive) return;
            e.stopPropagation();
            handlePointClick.call(this, e, d);
        });

    document.addEventListener('keydown', handleKeyPress);
}

async function handlePointClick(e, d) {
    if (!firstPointSelected) {
        if (firstPointElement) {
            d3.select(firstPointElement).style('fill', 'transparent').attr('r', 4);
        }

        firstPointElement = this;
        firstPointData = d;
        firstPointSelected = true;

        d3.select(this).style('fill', '#ff0000').attr('r', 3);

        const isBottom = this.classList.contains('ecg-point-bottom');
        const channel = isBottom ? fullSignalData.name : d3.select(this.closest('.ecg-graph')).select('text').text();
        const timeInSeconds = isBottom ? d.index / fullSignalData.samplingRate : d.x / 125;

        let preview = document.getElementById('markupPreview');
        if (!preview) {
            preview = document.getElementById('markupTableBody').appendChild(document.createElement('tr'));
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
            </td>
        `;
    } else {
        const isFirstBottom = firstPointElement.classList.contains('ecg-point-bottom');
        const isSecondBottom = this.classList.contains('ecg-point-bottom');

        if (isFirstBottom !== isSecondBottom) {
            await customAlert('Обе точки должны быть на одном графике');
            return;
        }

        if (!isFirstBottom && !isSecondBottom && this.closest('.ecg-graph') !== firstPointElement.closest('.ecg-graph')) {
            await customAlert('Обе точки должны быть в одном отведении');
            return;
        }

        if (secondPointElement) {
            d3.select(secondPointElement).style('fill', 'transparent').attr('r', 4);
        }

        secondPointElement = this;
        secondPointData = d;

        d3.select(this).style('fill', '#0066cc').attr('r', 3);

        const isBottom = this.classList.contains('ecg-point-bottom');
        const channel = isBottom ? fullSignalData.name : d3.select(this.closest('.ecg-graph')).select('text').text();
        const time1 = isBottom ? firstPointData.index / fullSignalData.samplingRate : firstPointData.x / 125;
        const time2 = isBottom ? d.index / fullSignalData.samplingRate : d.x / 125;

        markupData.push({
            type: currentSelectedWaveType,
            lead: channel,
            time1: +time1.toFixed(3),
            value1: +firstPointData.value.toFixed(4),
            time2: +time2.toFixed(3),
            value2: +d.value.toFixed(4),
            comment: document.getElementById('previewComment')?.value || ''
        });

        updateMarkupTable();
        clearSelection();
    }
}

function handleKeyPress(e) {
    if (e.key === 'Escape' && ecgPointSelectionActive) {
        clearSelection();
    } else if (e.key === 'Enter' && firstPointSelected && !secondPointData) {
        const isBottom = firstPointElement.classList.contains('ecg-point-bottom');
        const channel = isBottom ? fullSignalData.name : d3.select(firstPointElement.closest('.ecg-graph')).select('text').text();
        const time1 = isBottom ? firstPointData.index / fullSignalData.samplingRate : firstPointData.x / 125;

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
        .style('fill', 'transparent').attr('r', 4)
        .style('stroke', 'none').style('stroke-width', '0')
        .on('click.point-selection', null).style('cursor', '');

    ecgPointSelectionActive = firstPointSelected = false;
    firstPointData = firstPointElement = secondPointData = secondPointElement = null;
    document.body.style.cursor = '';

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
    const channel = isBottom ? fullSignalData.name : d3.select(firstPointElement.closest('.ecg-graph')).select('text').text();
    const time1 = isBottom ? firstPointData.index / fullSignalData.samplingRate : firstPointData.x / 125;

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

function updateMarkupTable() {
    const tb = document.getElementById('markupTableBody');

    clearHighlightedPoints();

    if (!markupData.length) {
        tb.innerHTML = '<tr><td colspan="8" class="empty-markup">Нет данных о разметке</td></tr>';
    } else {
        tb.innerHTML = markupData.map((item, index) => `
            <tr class="markup-row" data-markup-index="${index}" style="cursor: pointer;">
                <td>${item.type || ''}</td>
                <td>${item.lead || ''}</td>
                <td>${item.time1?.toFixed(3) || ''}</td>
                <td>${item.value1?.toFixed(4) || ''}</td>
                <td>${item.time2?.toFixed(3) || ''}</td>
                <td>${item.value2?.toFixed(4) || ''}</td>
                <td>${item.comment || ''}</td>
                <td style="text-align:center;"><button class="delete-markup-row-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; font-size:14px; color:#e57373;">✕</button></td>
            </tr>
        `).join('');

        document.querySelectorAll('.markup-row').forEach(row => {
            row.addEventListener('click', function (e) {
                if (e.target.classList.contains('delete-markup-row-btn')) return;
                const index = this.dataset.markupIndex;
                highlightMarkupPoints(parseInt(index));
                document.querySelectorAll('.markup-row').forEach(r => r.classList.remove('selected-markup-row'));
                this.classList.add('selected-markup-row');
            });
        });

        document.querySelectorAll('.delete-markup-row-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                deleteMarkupRow(index);
            });
        });
    }

    document.getElementById('markupModeToggle').checked = false;
}

function deleteMarkupRow(index) {
    if (index >= 0 && index < markupData.length) {
        markupData.splice(index, 1);
        updateMarkupTable();
        renderAllMarkupPoints();
        closeTooltip();
        customToast('Строка разметки удалена', 1500);
    }
}

function clearHighlightedPoints() {
    d3.selectAll('.ecg-graph .ecg-point, .ecg-point-bottom')
        .style('fill', 'transparent')
        .attr('r', 4)
        .style('stroke', null)
        .style('stroke-width', null);

    d3.selectAll('.ecg-line-highlight').remove();
    closeTooltip();
}

function highlightMarkupPoints(index) {
    if (!markupData[index] || !fullEcgData) return;

    const markup = markupData[index];

    clearHighlightedPoints();

    if (markup.lead === fullSignalData?.name) {
        const samplingRate = fullSignalData.samplingRate;
        const index1 = Math.round(markup.time1 * samplingRate);
        const index2 = markup.time2 > 0 ? Math.round(markup.time2 * samplingRate) : null;

        const points1 = d3.selectAll('.ecg-point-bottom').filter(d => Math.abs(d.index - index1) === 0);
        points1.style('fill', '#ff0000').attr('r', 3).style('stroke', '#ffffff').style('stroke-width', '1px');

        if (index2 !== null) {
            const points2 = d3.selectAll('.ecg-point-bottom').filter(d => Math.abs(d.index - index2) === 0);
            points2.style('fill', '#0066cc').attr('r', 3).style('stroke', '#ffffff').style('stroke-width', '1px');
            highlightLineBetweenPoints(index1, index2, true, index);
        }
    } else {
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
                .style('fill', '#ff0000').attr('r', 3)
                .style('stroke', '#ffffff').style('stroke-width', '1px');
        }

        if (x2 !== null) {
            const point2 = findPointByX(x2);
            if (point2) {
                d3.select(targetGraph).selectAll('.ecg-point')
                    .filter(d => d === point2)
                    .style('fill', '#0066cc').attr('r', 3)
                    .style('stroke', '#ffffff').style('stroke-width', '1px');
            }

            if (point1 && point2) {
                highlightLineBetweenPoints(point1.x, point2.x, false, index, targetGraph);
            }
        }
    }
}

function highlightLineBetweenPoints(pos1, pos2, isBottom, markupIndex, targetGraph = null) {
    let lineElement = null;
    if (isBottom) {
        const bottomSvg = d3.select('#bottom-lead svg');
        const line = bottomSvg.select('.ecg-line');
        const lineData = line.datum();
        if (lineData && lineData.length > 0) {
            const startIdx = Math.min(pos1, pos2);
            const endIdx = Math.max(pos1, pos2);
            const highlightedSection = lineData.filter(d => d.index >= startIdx && d.index <= endIdx);
            if (highlightedSection.length > 0) {
                lineElement = bottomSvg.select('g')
                    .append('path')
                    .datum(highlightedSection)
                    .attr('class', 'ecg-line-highlight')
                    .attr('data-markup-index', markupIndex)
                    .attr('d', d3.line().x(d => d.x).y(d => d.y).curve(d3.curveMonotoneX))
                    .attr('fill', 'none')
                    .attr('stroke', '#ffaa00')
                    .attr('stroke-width', 1.5)
                    .on('click', function (e) {
                        e.stopPropagation();
                        toggleTooltip(markupIndex, e);
                    });
            }
        }
    } else if (targetGraph) {
        const line = d3.select(targetGraph).select('.ecg-line');
        const lineData = line.datum();
        if (lineData && lineData.length > 0) {
            const startX = Math.min(pos1, pos2);
            const endX = Math.max(pos1, pos2);
            const highlightedSection = lineData.filter(d => d.x >= startX && d.x <= endX);
            if (highlightedSection.length > 0) {
                let lineGroup = d3.select(targetGraph).select('.ecg-line-group');
                if (lineGroup.empty()) {
                    lineGroup = d3.select(targetGraph).append('g').attr('class', 'ecg-line-group');
                }
                lineElement = lineGroup.append('path')
                    .datum(highlightedSection)
                    .attr('class', 'ecg-line-highlight')
                    .attr('data-markup-index', markupIndex)
                    .attr('d', d3.line().x(d => d.x).y(d => d.y).curve(d3.curveMonotoneX))
                    .attr('fill', 'none')
                    .attr('stroke', '#ffaa00')
                    .attr('stroke-width', 1.5)
                    .on('click', function (e) {
                        e.stopPropagation();
                        toggleTooltip(markupIndex, e);
                    });
            }
        }
    }
}

function closeTooltip() {
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
        currentTooltipMarkupIndex = null;
    }
}

function toggleTooltip(index, event) {
    if (currentTooltip && currentTooltipMarkupIndex === index) {
        closeTooltip();
        return;
    }
    closeTooltip();

    const item = markupData[index];
    if (!item) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'inline-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        min-width: 200px;
        max-width: 300px;
        pointer-events: auto;
    `;

    tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>Детали разметки</strong>
            <button class="tooltip-close" style="background:none; border:none; cursor:pointer; font-size:16px;">✕</button>
        </div>
        <p><strong>Зубец:</strong> ${item.type}</p>
        <p><strong>Отведение:</strong> ${item.lead}</p>
        <p><strong>Время 1:</strong> ${item.time1?.toFixed(3)} с</p>
        <p><strong>Амплитуда 1:</strong> ${item.value1?.toFixed(4)}</p>
        <p><strong>Время 2:</strong> ${item.time2?.toFixed(3) || '—'}</p>
        <p><strong>Амплитуда 2:</strong> ${item.value2?.toFixed(4) || '—'}</p>
        <p><strong>Комментарий:</strong> ${item.comment || '—'}</p>
        <button class="delete-from-tooltip" style="margin-top:8px; width:100%; padding:4px; background:#e0e0e0; border:1px solid #ccc; border-radius:4px; cursor:pointer;">✕ Удалить</button>
    `;

    // Позиционируем рядом с курсором
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY - 30) + 'px';

    document.body.appendChild(tooltip);

    const closeBtn = tooltip.querySelector('.tooltip-close');
    const deleteBtn = tooltip.querySelector('.delete-from-tooltip');

    closeBtn.addEventListener('click', () => closeTooltip());
    deleteBtn.addEventListener('click', () => {
        deleteMarkupRow(index);
        closeTooltip();
    });

    // Закрытие по клику вне тултипа
    const clickOutside = (e) => {
        if (!tooltip.contains(e.target)) {
            closeTooltip();
            document.removeEventListener('click', clickOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', clickOutside), 0);

    currentTooltip = tooltip;
    currentTooltipMarkupIndex = index;
}

function renderAllMarkupPoints() {
    clearHighlightedPoints();
    if (!markupData.length || !fullEcgData) return;

    for (let i = 0; i < markupData.length; i++) {
        const markup = markupData[i];
        if (markup.lead === fullSignalData?.name) {
            const samplingRate = fullSignalData.samplingRate;
            const index1 = Math.round(markup.time1 * samplingRate);
            const index2 = markup.time2 > 0 ? Math.round(markup.time2 * samplingRate) : null;

            const points1 = d3.selectAll('.ecg-point-bottom').filter(d => Math.abs(d.index - index1) === 0);
            points1.style('fill', '#ff0000').attr('r', 3).style('stroke', '#ffffff').style('stroke-width', '1px');

            if (index2 !== null) {
                const points2 = d3.selectAll('.ecg-point-bottom').filter(d => Math.abs(d.index - index2) === 0);
                points2.style('fill', '#0066cc').attr('r', 3).style('stroke', '#ffffff').style('stroke-width', '1px');
                highlightLineBetweenPoints(index1, index2, true, i);
            }
        } else {
            const channelIndex = fullEcgData.channelNames.findIndex(name => name === markup.lead);
            if (channelIndex === -1) continue;

            const containerId = channelIndex < 6 ? 'standard-leads' : 'chest-leads';
            const graphIndex = channelIndex < 6 ? channelIndex : channelIndex - 6;
            const container = document.getElementById(containerId);
            if (!container) continue;

            const graphs = container.querySelectorAll('.ecg-graph');
            if (graphIndex >= graphs.length) continue;

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
                    .style('fill', '#ff0000').attr('r', 3)
                    .style('stroke', '#ffffff').style('stroke-width', '1px');
            }

            if (x2 !== null) {
                const point2 = findPointByX(x2);
                if (point2) {
                    d3.select(targetGraph).selectAll('.ecg-point')
                        .filter(d => d === point2)
                        .style('fill', '#0066cc').attr('r', 3)
                        .style('stroke', '#ffffff').style('stroke-width', '1px');
                }

                if (point1 && point2) {
                    highlightLineBetweenPoints(point1.x, point2.x, false, i, targetGraph);
                }
            }
        }
    }
}

function reloadMarkupDisplay() {
    renderAllMarkupPoints();
}

const style = document.createElement('style');
style.textContent = `
    .markup-row:hover { background-color: #f0f8ff; }
    .markup-row.selected-markup-row { background-color: #e6f3ff; border-left: 3px solid #2c6fbb; }
    .ecg-line-highlight { pointer-events: all; cursor: pointer; }
    .ecg-line-highlight:hover { stroke: #ff6600; stroke-width: 2.5; }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    .modal-window {
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 320px;
        max-width: 90%;
        padding: 20px;
        position: relative;
        text-align: center;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    .modal-close {
        position: absolute;
        top: 12px;
        right: 16px;
        font-size: 24px;
        cursor: pointer;
        color: #888;
        transition: color 0.2s;
    }
    .modal-close:hover { color: #333; }
    .modal-message {
        margin: 20px 0 25px;
        font-size: 16px;
        line-height: 1.4;
        color: #1e2a3a;
    }
    .modal-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
    }
    .modal-btn {
        padding: 8px 20px;
        border: none;
        border-radius: 40px;
        font-size: 14px;
        cursor: pointer;
        transition: 0.2s;
    }
    .modal-btn-ok {
        background: #2c6fbb;
        color: white;
    }
    .modal-btn-ok:hover { background: #1e4f8a; }
    .modal-btn-cancel {
        background: #f1f3f4;
        color: #444;
    }
    .modal-btn-cancel:hover { background: #e0e2e5; }
    @keyframes modalFadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .modal-window {
        animation: modalFadeIn 0.2s ease-out;
    }

    .delete-record-btn, .delete-markup-btn, .delete-markup-row-btn {
        background-color: #e0e0e0;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 2px 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
    }
    .delete-record-btn:hover, .delete-markup-btn:hover, .delete-markup-row-btn:hover {
        background-color: #e4aaaa;
        border-color: #cd6767;
        color: #333;
    }
`;
document.head.appendChild(style);

const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

async function saveAllMarkupPoints() {
    if (!markupData || markupData.length === 0) {
        await customAlert('Нет точек для сохранения');
        return;
    }

    if (!currentRecord?.recordId) {
        await customAlert('Не выбрана запись ЭКГ');
        return;
    }

    const saveBtn = document.getElementById('saveMarkupBtn');
    const statusEl = document.getElementById('saveMarkupStatus');

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
        statusEl.textContent = 'Создание разметки...';

        const createResponse = await fetch(`${API_BASE_URL}/markupjson/create-for-record/${currentRecord.recordId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

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

        statusEl.textContent = 'Загрузка...';

        const formData = new FormData();
        const blob = new Blob([JSON.stringify(markupJson)], { type: 'application/json' });
        formData.append('file', blob, `markup_${markupId}.json`);

        const uploadResponse = await fetch(`${API_BASE_URL}/markupjson/upload/${markupId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('Не удалось загрузить JSON');
        }

        markupData = [];
        updateMarkupTable();
        statusEl.textContent = '';
        await customToast('Разметка успешно сохранена', 2000);

    } catch (error) {
        statusEl.textContent = 'Ошибка сохранения';
        await customAlert('Ошибка при сохранении разметки: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить все';
    }
}

async function loadRecordMarkups(recordId) {
    if (!recordId) {
        document.getElementById('markupsList').innerHTML = '<div class="no-data">Выберите запись</div>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/markupjson/record-markups/${recordId}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Не удалось загрузить разметки');
        }

        const data = await response.json();
        displayMarkupsList(data.markups);

    } catch (error) {
        document.getElementById('markupsList').innerHTML = '<div class="no-data error">Ошибка загрузки</div>';
    }
}

function displayMarkupsList(markups) {
    const container = document.getElementById('markupsList');

    if (!markups || markups.length === 0) {
        container.innerHTML = '<div class="no-data">Нет разметок для этой записи</div>';
        return;
    }

    container.innerHTML = markups.map(m => {
        const titleDate = formatDateTimeForTitle(m.createdAt);
        const readableDate = formatReadableDateTime(m.createdAt);
        return `
        <div class="markup-card" id="markup-${m.idMarkup}">
            <div class="markup-header" onclick="loadMarkupPoints(${m.idMarkup})" style="cursor: pointer; padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 500;">Markup_${titleDate}</div>
                    <div style="font-size: 10px; color: #888;">время загрузки: ${readableDate}</div>
                </div>
                <button class="delete-markup-btn" onclick="deleteMarkup(${m.idMarkup}, event)">✕</button>
            </div>
            <div class="markup-meta" onclick="loadMarkupPoints(${m.idMarkup})" style="cursor: pointer; padding: 4px 8px 8px 8px; font-size: 12px; color: #666;">
                ${formatFileSize(m.markupFileSize || 0)}
            </div>
        </div>`;
    }).join('');
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

        const response = await fetch(`${API_BASE_URL}/markupjson/download/${markupId}`, {
            headers: getAuthHeaders()
        });

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

        const tableContainer = document.querySelector('.markup-table-container');
        if (tableContainer) {
            tableContainer.style.transition = 'background 0.5s';
            tableContainer.style.background = '#e8f5e8';
            setTimeout(() => {
                tableContainer.style.background = '';
            }, 500);
        }

        renderAllMarkupPoints();

    } catch (error) {
        await customAlert('Не удалось загрузить точки разметки');
    } finally {
        const card = document.getElementById(`markup-${markupId}`);
        if (card) {
            card.style.opacity = '';
            card.style.pointerEvents = '';
        }
    }
}

async function deleteRecord(recordId, event) {
    if (event) event.stopPropagation();

    const userConfirmed = await customConfirm('Вы уверены, что хотите удалить эту запись? Все связанные разметки также будут удалены.');
    if (!userConfirmed) return;

    const recordCard = document.getElementById(`record-${recordId}`);
    const originalContent = recordCard.innerHTML;

    try {
        recordCard.style.opacity = '0.5';
        recordCard.style.pointerEvents = 'none';
        recordCard.innerHTML = '<div style="text-align:center;padding:20px;">Удаление...</div>';

        const response = await fetch(`${API_BASE_URL}/npyfiles/delete/${recordId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Не удалось удалить запись');
        }

        const recordElement = document.getElementById(`record-${recordId}`);
        if (recordElement) recordElement.remove();

        if (currentRecord?.recordId === recordId) {
            markupData = [];
            updateMarkupTable();
            currentRecord = null;
            fullEcgData = null;
            fullSignalData = null;
            selectedChannelIndex = null;

            document.getElementById('paramsData').innerHTML = '';
            document.getElementById('markupsList').innerHTML = '<div class="no-data">Выберите запись</div>';
            clearBottomGraph();
        }

        await customToast('Запись успешно удалена');

    } catch (error) {
        recordCard.style.opacity = '';
        recordCard.style.pointerEvents = '';
        recordCard.innerHTML = originalContent;
        await customToast('Ошибка при удалении записи: ' + error.message);
    }
}

async function deleteMarkup(markupId, event) {
    if (event) event.stopPropagation();

    const userConfirmed = await customConfirm('Вы уверены, что хотите удалить эту разметку?');
    if (!userConfirmed) return;

    const markupCard = document.getElementById(`markup-${markupId}`);
    const originalContent = markupCard.innerHTML;

    try {
        markupCard.style.opacity = '0.5';
        markupCard.style.pointerEvents = 'none';
        markupCard.innerHTML = '<div style="text-align:center;padding:10px;">Удаление...</div>';

        const response = await fetch(`${API_BASE_URL}/markupjson/delete/${markupId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Не удалось удалить разметку');

        const markupElement = document.getElementById(`markup-${markupId}`);
        if (markupElement) markupElement.remove();

        const markupsList = document.getElementById('markupsList');
        if (markupsList.children.length === 0) {
            markupsList.innerHTML = '<div class="no-data">Нет разметок для этой записи</div>';
        }

        await customToast('Разметка успешно удалена');

    } catch (error) {
        markupCard.style.opacity = '';
        markupCard.style.pointerEvents = '';
        markupCard.innerHTML = originalContent;
        await customToast('Ошибка при удалении разметки: ' + error.message);
    }
}

async function loadDoctorRecords() {
    try {
        if (!currentDoctorId) {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const u = await response.json();
                if (u?.idDoctor) {
                    currentDoctorId = u.idDoctor;
                } else {
                    await customAlert('Не удалось загрузить данные врача');
                    return;
                }
            } else {
                await customAlert('Не удалось загрузить данные врача');
                return;
            }
        }

        const r = await fetch(`${API_BASE_URL}/npyfiles/doctor-records/${currentDoctorId}`, {
            headers: getAuthHeaders()
        });

        if (!r?.ok) {
            await customAlert('Не удалось загрузить список записей');
            return;
        }

        const records = await r.json();
        const list = document.getElementById('recordsList');

        if (!list) return;

        if (!records?.length) {
            list.innerHTML = '<div class="no-data">Записей не найдено</div>';
            return;
        }

        list.innerHTML = records.map(r => {
            const titleDate = formatDateTimeForTitle(r.uploadedAt);
            const readableDate = formatReadableDateTime(r.uploadedAt);
            return `
            <div class="record-card" id="record-${r.recordId}">
                <div class="record-header" onclick="loadRecord(${r.recordId})" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 8px;">
                    <div>
                        <div style="font-weight: 500;">Record_${titleDate}</div>
                        <div style="font-size: 10px; color: #888;">время загрузки: ${readableDate}</div>
                    </div>
                    <button class="delete-record-btn" onclick="deleteRecord(${r.recordId}, event)">✕</button>
                </div>
                <div class="record-meta" style="cursor: pointer; padding: 0 8px 8px 8px; font-size: 12px; color: #666;" onclick="loadRecord(${r.recordId})">
                    ${formatFileSize(r.fileSize)}
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        await customAlert('Ошибка при загрузке списка записей: ' + error.message);
    }
}

async function loadRecord(recordId) {
    try {
        destroyZoomHandlers();
        currentZoomState = null;
        clearBottomGraph();
        markupData = [];
        updateMarkupTable();

        const r = await fetch(`${API_BASE_URL}/npyfiles/info/${recordId}`, {
            headers: getAuthHeaders()
        });

        if (!r?.ok) return;

        currentRecord = await r.json();

        document.getElementById('paramsData').innerHTML = `
            <table style="width:100%; border-collapse:collapse;">
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 0; color:#555;">ID записи:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:500;">${currentRecord.recordId}</td>
                </tr>
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 0; color:#555;">Частота дискретизации:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:500;">${currentRecord.samplingRate} Гц</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#555;">Тип сигнала:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:500;">${getSignalType(currentRecord.type)}</td>
                </tr>
            </table>
        `;

        document.querySelectorAll('.record-card').forEach(c => c.classList.remove('active'));
        document.getElementById(`record-${recordId}`)?.classList.add('active');

        await loadParsedEcgData(recordId);
        await loadRecordMarkups(recordId);

    } catch (error) {
        await customAlert('Ошибка при загрузке записи: ' + error.message);
    }
}

async function loadParsedEcgData(recordId) {
    try {
        const r = await fetch(`${API_BASE_URL}/npyfiles/ecg-data/${recordId}`, {
            headers: getAuthHeaders()
        });

        if (!r?.ok) {
            await customAlert('Failed to load ECG data');
            return;
        }

        const d = JSON.parse(await r.text());
        if (!d.channels) {
            await customAlert('Данные каналов не получены');
            return;
        }

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
            (fullEcgData.channelNames?.map((n, i) => `<option value="${i}">${n}</option>`).join('') || '');

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
        await customAlert('Ошибка загрузки ЭКГ: ' + error.message);
    }
}

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    if (!currentDoctorId) {
        await customAlert('Сначала необходимо авторизоваться');
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
            const createResponse = await fetch(`${API_BASE_URL}/npyfiles/create-record`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    idDoctor: currentDoctorId,
                    rc: 0,
                    type: 1
                })
            });

            if (!createResponse.ok) {
                throw new Error(`Ошибка создания записи для файла ${file.name}`);
            }

            const createResult = await createResponse.json();
            const recordId = createResult.recordId;

            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(`${API_BASE_URL}/npyfiles/upload/${recordId}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: formData
            });

            if (uploadResponse.ok) {
                successCount++;
            } else {
                errorCount++;
            }

        } catch (error) {
            errorCount++;
        }
    }

    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;

    await customAlert(`Загружено: ${successCount} файлов\nОшибок: ${errorCount}`);

    if (successCount > 0) {
        await loadDoctorRecords();
    }
}

async function handleLogout() {
    const userConfirmed = await customConfirm('Вы уверены, что хотите выйти?');
    if (userConfirmed) {
        markupData = [];
        updateMarkupTable();
        currentRecord = null;
        fullEcgData = null;
        fullSignalData = null;
        selectedChannelIndex = null;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadDoctorRecords();
    setTimeout(createEcgGrids, 500);

    document.querySelectorAll('input[name="wave-type"]')
        .forEach(s => s.addEventListener('change', function () {
            if (this.checked) currentSelectedWaveType = this.value;
        }));

    document.getElementById('markupModeToggle')
        ?.addEventListener('change', function () {
            this.checked ? initializePointSelection() : cancelPointSelection();
        });

    const reloadBtn = document.getElementById('reloadMarkupsBtn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            reloadMarkupDisplay();
        });
    }
});

window.loadRecord = loadRecord;
window.loadDoctorRecords = loadDoctorRecords;
window.handleLogout = handleLogout;
window.loadRecordMarkups = loadRecordMarkups;
window.selectMarkup = selectMarkup;
window.loadMarkupPoints = loadMarkupPoints;
window.saveAllMarkupPoints = saveAllMarkupPoints;
window.cancelPointSelection = cancelPointSelection;
window.saveSinglePoint = saveSinglePoint;
window.destroyZoomHandlers = destroyZoomHandlers;
window.deleteRecord = deleteRecord;
window.deleteMarkup = deleteMarkup;
window.reloadMarkupDisplay = reloadMarkupDisplay;