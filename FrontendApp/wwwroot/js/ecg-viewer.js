
class EcgViewerService {
    constructor() {
        this.baseUrl = 'http://localhost:5104/api/npyfiles';
        this.currentDoctorId = null;
        this.currentRecord = null;
        this.displayMode = 'all';
        this.currentChannelIndex = 0;
        this.fullEcgData = null;
    }

    async loadDoctorRecords() {
        try {
            if (!this.currentDoctorId) {
                await this.loadCurrentDoctor();
            }

            const response = await authService.apiRequest(`${this.baseUrl}/doctor-records/${this.currentDoctorId}`);

            if (response && response.ok) {
                const records = await response.json();

                this.displayRecords(records);
                return records;
            } else {
                this.showError('Не удалось загрузить список записей');
            }
        } catch (error) {
            this.showError('Ошибка при загрузке списка записей');
        }
    }

    async loadCurrentDoctor() {
        try {
            const user = await authService.getCurrentUser();

            if (user && user.idDoctor) {
                this.currentDoctorId = user.idDoctor;
                return user;
            } else {
                this.showError('Не удалось загрузить данные врача');
            }
        } catch (error) {
            console.error('Load doctor error:', error);
            this.showError('Ошибка при загрузке данных врача');
        }
    }

    async loadRecord(recordId) {
        try {
            const infoResponse = await authService.apiRequest(`${this.baseUrl}/info/${recordId}`);
            if (infoResponse && infoResponse.ok) {
                const recordInfo = await infoResponse.json();
                this.currentRecord = recordInfo;
                this.displayRecordParams(recordInfo);
                this.highlightActiveRecord(recordId);

                await this.loadParsedEcgData(recordId);
            }
        } catch (error) {
            console.error('Load record error:', error);
            this.showError('Ошибка при загрузке записи: ' + error.message);
        }
    }

    async loadParsedEcgData(recordId) {
        try {
            const response = await authService.apiRequest(`${this.baseUrl}/ecg-data/${recordId}`);

            if (response && response.ok) {
                const responseText = await response.text();
                const ecgData = JSON.parse(responseText);

                if (!ecgData.channels || !Array.isArray(ecgData.channels)) {
                    this.showError('Данные каналов не получены');
                    return;
                }

                this.fullEcgData = {
                    channels: ecgData.channels,
                    channelNames: ecgData.channelNames,
                    samplingRate: 500
                };

                this.displayAllChannelsD3(this.fullEcgData.channels, this.fullEcgData.channelNames);
                this.addViewModeControls();

            } else {
                this.showError('Failed to load ECG data');
            }
        } catch (error) {
            this.showError('Ошибка загрузки данных ЭКГ: ' + error.message);
        }
    }

    addViewModeControls() {
        const controlsHtml = `
            <div class="view-mode-controls">
                <div class="control-group">
                    <strong>Режим просмотра:</strong>
                    <button onclick="ecgViewer.setViewMode('all')" class="view-btn active">Все 12 каналов</button>
                    <button onclick="ecgViewer.setViewMode('single')" class="view-btn">Один канал</button>
                </div>
                <div class="control-group" id="channelSelection" style="display: none;">
                    <strong>Выберите канал:</strong>
                    <select id="channelSelector" onchange="ecgViewer.selectChannel(this.value)">
                        ${this.fullEcgData.channelNames.map((name, index) =>
            `<option value="${index}">${name}</option>`
        ).join('')}
                    </select>
                </div>
            </div>
        `;

        const graphsSection = document.querySelector('.graphs-section');
        if (graphsSection && !document.querySelector('.view-mode-controls')) {
            graphsSection.insertAdjacentHTML('afterbegin', controlsHtml);
        }
    }

    setViewMode(mode) {
        this.displayMode = mode;

        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        const channelSelection = document.getElementById('channelSelection');
        channelSelection.style.display = mode === 'single' ? 'block' : 'none';

        this.redisplayChannels();
    }

    selectChannel(channelIndex) {
        this.currentChannelIndex = parseInt(channelIndex);
        this.redisplayChannels();
    }

    redisplayChannels() {
        if (!this.fullEcgData) return;

        if (this.displayMode === 'all') {
            this.displayAllChannelsD3(this.fullEcgData.channels, this.fullEcgData.channelNames);
        } else {
            this.displaySingleChannel(this.currentChannelIndex);
        }
    }

    displaySingleChannel(channelIndex) {
        const singleChannelData = [this.fullEcgData.channels[channelIndex]];
        const singleChannelNames = [this.fullEcgData.channelNames[channelIndex]];

        this.displayAllChannelsD3(singleChannelData, singleChannelNames);
    }

    /* Значение частоты забирать из БД, поправить одновременно со структурами данных в Web Api NpyService */
    displayAllChannelsD3(channels, channelNames) {
        renderEcgOnGrids(channels, channelNames, 500);
    }

    displayRecordParams(record) {
        const paramsContent = document.getElementById('paramsData');

        paramsContent.innerHTML = `
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">ID записи</div>
                    <div class="param-value">${record.recordId}</div>
                </div>
            </div>
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">Частота дискретизации</div>
                    <div class="param-value">${record.samplingRate} Гц</div>
                </div>
            </div>
            <div class="param-item">
                <div class="param-content">
                    <div class="param-label">Тип сигнала</div>
                    <div class="param-value">${this.getSignalType(record.type)}</div>
                </div>
            </div>
        `;
    }

    displayRecords(records) {
        const recordsList = document.getElementById('recordsList');

        if (!records || records.length === 0) {
            recordsList.innerHTML = `
                <div class="no-data">
                    <div>Записей не найдено</div>
                </div>
            `;
            return;
        }

        recordsList.innerHTML = records.map(record => `
            <div class="record-card" onclick="ecgViewer.loadRecord(${record.recordId})" 
                 id="record-${record.recordId}">
                <div class="record-header">ЭКГ #${record.recordId}</div>
                <div class="record-meta">
                    ${new Date(record.uploadedAt).toLocaleDateString('ru-RU')} 
                    ${new Date(record.uploadedAt).toLocaleTimeString('ru-RU')}
                </div>
                <div class="record-meta">${this.formatFileSize(record.fileSize)}</div>
            </div>
        `).join('');
    }

    highlightActiveRecord(recordId) {
        document.querySelectorAll('.record-card').forEach(card => {
            card.classList.remove('active');
        });

        const activeCard = document.getElementById(`record-${recordId}`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';

        const sizes = ['B', 'KB', 'MB', 'GB'];
        let order = 0;
        let len = bytes;

        while (len >= 1024 && order < sizes.length - 1) {
            order++;
            len /= 1024;
        }

        return `${len.toFixed(2)} ${sizes[order]}`;
    }

    getSignalType(type) {
        const types = {
            1: 'ЭКГ',
            2: 'ММГ',
            3: 'ЭЭГ'
        };
        return types[type] || `Тип ${type}`;
    }

    showError(message) {
        alert('Ошибка: ' + message);
    }
}

const ecgViewer = new EcgViewerService();

const MM_PER_SECOND = 25; // 25 мм/с
const MM_PER_CELL = 5;    // 5 мм на клетку
const CELLS_PER_SECOND = MM_PER_SECOND / MM_PER_CELL; // 5 клеток в секунду
const MV_PER_CELL = 10;   // 10 мВ на клетку
const PIXELS_PER_MM = 5;  // 5 пикселей на 1 мм (стандарт для ЭКГ)

const CELL_SIZE_PX = MM_PER_CELL * PIXELS_PER_MM; // 25px на клетку 5×5мм
const SECONDS_TO_DISPLAY = 4; // Показываем 10 секунд

// Функции для отрисовки графиков и сеток
function createEcgGrids() {
    const graphContainers = d3.selectAll('.graph-container');

    graphContainers.each(function (d, i) {
        const container = this;
        const existingTitle = d3.select(container).select('.graph-title');

        d3.select(container).html('');
        if (!existingTitle.empty()) {
            d3.select(container).node().appendChild(existingTitle.node());
        }

        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;


        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', '#ffffff')
            .style('overflow', 'hidden'); // Скрываем всё что выходит за границы

        const contentGroup = svg.append('g')
            .attr('class', 'zoom-content-group');

        createGridWithLabels(contentGroup, width, height);
    });

    setTimeout(setupUnifiedZoom, 500);
}

function createGridWithLabels(contentGroup, width, height) {
    const CELL_SIZE = 25; // 25px на клетку 5×5мм
    const SMALL_CELLS = 5; // 5 маленьких клеток в большой

    const smallGrid = CELL_SIZE / SMALL_CELLS; // 5px
    const mediumGrid = CELL_SIZE; // 25px
    const largeGrid = mediumGrid * 5; // 125px

    const displayWidth = width * 2;
    const displayHeight = height * 2;

    for (let x = 0; x <= displayWidth; x += smallGrid) {
        contentGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', displayHeight)
            .attr('stroke', '#f5f5f5')
            .attr('stroke-width', 0.3);
    }

    for (let y = 0; y <= displayHeight; y += smallGrid) {
        contentGroup.append('line')
            .attr('x1', 0).attr('x2', displayWidth)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#f5f5f5')
            .attr('stroke-width', 0.3);
    }

    for (let x = 0; x <= displayWidth; x += mediumGrid) {
        contentGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', displayHeight)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    for (let y = 0; y <= displayWidth; y += mediumGrid) {
        contentGroup.append('line')
            .attr('x1', 0).attr('x2', displayWidth)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    for (let x = 0; x <= displayWidth; x += largeGrid) {
        contentGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', displayHeight)
            .attr('stroke', '#d0d0d0')
            .attr('stroke-width', 0.8);
    }

    for (let y = 0; y <= displayHeight; y += largeGrid) {
        contentGroup.append('line')
            .attr('x1', 0).attr('x2', displayWidth)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#d0d0d0')
            .attr('stroke-width', 0.8);
    }

    const voltageLevels = [-1, 0, 1];
    const labelOffset = 5;

    voltageLevels.forEach(voltage => {
        const yPos = (height / 2) - (voltage * 50);
        contentGroup.append('text')
            .attr('x', labelOffset)
            .attr('y', yPos)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#665')
            .style('font-weight', 'bold')
            .text(voltage + ' мВ');
    });
}

/* Значение частоты забирать из БД, поправить одновременно со структурами данных в Web Api NpyService */
function setupUnifiedZoom() {
    const svgs = d3.selectAll('.graph-container svg');

    svgs.each(function () {
        const container = this.parentElement;
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;

        // ВЫЧИСЛЯЕМ НАЧАЛЬНЫЙ ЗУМ ДЛЯ ПРИБЛИЖЕНИЯ
        const pxPerSecond = 125; // 125px/секунда
        const fullWidthForDisplay = pxPerSecond * SECONDS_TO_DISPLAY; // полная ширина для SECONDS_TO_DISPLAY секунд

        // Начальный зум = увеличение чтобы SECONDS_TO_DISPLAY секунд вместились в контейнер
        const initialScale = containerWidth / fullWidthForDisplay;

        const zoom = d3.zoom()
            .scaleExtent([initialScale, 5]) // Мин = начальный зум (увеличение), макс = 5x
            .on('zoom', function (event) {
                const transform = event.transform;

                // ЗАПРЕЩАЕМ отдаление меньше начального масштаба
                if (transform.k < initialScale) {
                    transform.k = initialScale;
                    transform.x = 0;
                    transform.y = 0;
                }

                const limitedTransform = limitPan(transform, this, initialScale, fullWidthForDisplay);
                d3.select(this).selectAll('.zoom-content-group')
                    .attr('transform', limitedTransform);
            })
            .filter(function (event) {
                // РАЗРЕШАЕМ ПЕРЕТАСКИВАНИЕ ВСЕГДА
                return true;
            });

        const svg = d3.select(this);
        const initialTransform = d3.zoomIdentity.scale(initialScale);

        svg.call(zoom)
            .call(zoom.transform, initialTransform)
            .on('dblclick.zoom', null);
    });
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ ОГРАНИЧЕНИЙ - только область с данными
function limitPan(transform, svgElement, initialScale, fullWidthForDisplay) {
    const containerRect = svgElement.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // ОБЛАСТЬ С ДАННЫМИ (только SECONDS_TO_DISPLAY секунд)
    const dataWidth = fullWidthForDisplay; // ширина данных в пикселях
    const dataHeight = height; // высота данных (увеличенная область)

    // Вычисляем видимую область после зума
    const scaledDataWidth = dataWidth * transform.k;
    const scaledDataHeight = dataHeight * transform.k;

    // ОГРАНИЧЕНИЯ ПО X (горизонталь) - ТОЛЬКО ОБЛАСТЬ С ДАННЫМИ
    const maxX = 0; // Нельзя уходить вправо за начало данных
    const minX = Math.min(0, width - scaledDataWidth); // Нельзя уходить влево дальше чем конец данных

    // ОГРАНИЧЕНИЯ ПО Y (вертикаль) - ТОЛЬКО ОБЛАСТЬ С ДАННЫМИ
    const maxY = 0; // Нельзя уходить вниз за начало данных
    const minY = Math.min(0, height - scaledDataHeight); // Нельзя уходить вверх дальше чем конец данных

    // ДОПОЛНИТЕЛЬНО: ограничиваем чтобы не показывать пустые области за данными
    const limitedX = Math.max(minX, Math.min(maxX, transform.x));
    const limitedY = Math.max(minY, Math.min(maxY, transform.y));

    return d3.zoomIdentity
        .scale(transform.k)
        .translate(limitedX, limitedY);
}

// Обновляем renderEcgOnGrids чтобы график рисовался только в области данных
function renderEcgOnGrids(channelsData, channelNames, samplingRate = 500) {
    const graphContainers = d3.selectAll('.graph-container');

    graphContainers.each(function (d, i) {
        if (i >= channelsData.length) {
            this.style.display = 'none';
            return;
        }

        this.style.display = 'block';
        const container = this;
        const channelData = channelsData[i];

        const contentGroup = d3.select(container).select('.zoom-content-group');
        if (contentGroup.empty()) return;

        contentGroup.selectAll('.ecg-line').remove();

        // РАЗМЕРЫ КОНТЕЙНЕРА
        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;

        const totalPointsToDisplay = samplingRate * SECONDS_TO_DISPLAY;

        // ОБЛАСТЬ ДАННЫХ - только SECONDS_TO_DISPLAY секунд
        const dataWidth = 125 * SECONDS_TO_DISPLAY; // 125px/сек × количество секунд

        // ПРЕОБРАЗУЕМ В ПИКСЕЛИ ОТНОСИТЕЛЬНО КОНТЕЙНЕРА (только в области данных)
        const displayData = channelData.slice(0, totalPointsToDisplay).map((value, index) => {
            const x = (index / samplingRate) * 125; // 125px/секунда
            // Ограничиваем x областью данных
            const limitedX = Math.min(x, dataWidth - 1);
            const y = (height / 2) - (value * 50); // 50px/мВ
            return { x: limitedX, y };
        });

        const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveMonotoneX);

        contentGroup.append('path')
            .datum(displayData)
            .attr('d', lineGenerator)
            .attr('fill', 'none')
            .attr('stroke', '#2c6fbb')
            .attr('stroke-width', 0.3)
            .attr('stroke-linecap', 'round')
            .attr('class', 'ecg-line');
    });
}
// Обновляем limitPan с правильными ограничениями

// Обновляем resetZoomToFit
function resetZoomToFit() {
    const svgs = d3.selectAll('.graph-container svg');

    svgs.each(function () {
        const container = this.parentElement;
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;

        const pxPerSecond = 125;
        const fullWidthForDisplay = pxPerSecond * SECONDS_TO_DISPLAY;
        const initialScale = containerWidth / fullWidthForDisplay;

        const initialTransform = d3.zoomIdentity.scale(initialScale);

        d3.select(this).transition().duration(250).call(
            d3.zoom().transform,
            initialTransform
        );
    });
}

// Обновляем zoomIn с учетом ограничений
function zoomIn() {
    const svgs = d3.selectAll('.graph-container svg');
    svgs.each(function () {
        const svg = d3.select(this);
        const currentTransform = d3.zoomTransform(svg.node());
        const newScale = Math.min(5, currentTransform.k * 1.5);

        // При зуме центрируем на текущей позиции
        const newTransform = d3.zoomIdentity
            .scale(newScale)
            .translate(currentTransform.x, currentTransform.y);

        svg.transition().duration(250).call(
            d3.zoom().transform,
            newTransform
        );
    });
}

// Глобальные функции
async function loadDoctorRecords() {
    await ecgViewer.loadDoctorRecords();
}

async function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        await authService.logout();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await ecgViewer.loadDoctorRecords();
    } catch (error) {
        console.error('Initial load failed:', error);
    }
});

setTimeout(createEcgGrids, 100);

window.addEventListener('resize', function () {
    setTimeout(createEcgGrids, 100);
});
