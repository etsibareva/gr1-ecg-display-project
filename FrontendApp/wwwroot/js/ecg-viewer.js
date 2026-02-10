class ContainerZoomHandler {
    constructor(containerIds) {
        this.containers = containerIds.map(id => document.getElementById(id));
        this.svgs = this.containers.map(container => d3.select(container).select('svg'));
        this.initialTransforms = new Map();
        this.initZoom();
    }

    initZoom() {
        if (this.svgs.some(svg => svg.empty())) {
            return;
        }

        this.saveInitialTransforms();

        this.zoom = d3.zoom()
            .scaleExtent([1, 10])
            .translateExtent([[0, 0], [1000, 1188]])
            .on('zoom', (event) => {
                // Проверяем, не идет ли процесс добавления точки
                if (!window.ecgPointSelectionActive) {
                    this.handleZoom(event);
                }
            });

        this.svgs.forEach(svg => {
            svg.call(this.zoom);
            svg.call(this.zoom).on("dblclick.zoom", null);
            svg.on('click.point', function (event) {
                if (window.ecgPointSelectionActive && event.target.classList.contains('ecg-point')) {
                    event.stopPropagation();
                }
            });
        });

        this.addControls();
    }

    saveInitialTransforms() {
        this.initialTransforms.clear();

        this.containers.forEach(container => {
            const graphs = container.querySelectorAll('.ecg-graph');
            graphs.forEach((graph) => {
                const transform = d3.select(graph).attr('transform') || 'translate(0,0)';
                this.initialTransforms.set(graph, transform);
            });
        });
    }

    handleZoom(event) {
        const transform = event.transform;

        this.initialTransforms.forEach((initialTransform, graphElement) => {
            const graph = d3.select(graphElement);

            const initial = this.parseTransform(initialTransform);

            const combinedTransform = `
                translate(${transform.x}, ${transform.y})
                scale(${transform.k})
                translate(${initial.x}, ${initial.y})
            `;

            graph.attr('transform', combinedTransform);
        });
    }

    parseTransform(transformString) {
        const result = { x: 0, y: 0 };
        if (!transformString) return result;

        const translateMatch = transformString.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (translateMatch) {
            result.x = parseFloat(translateMatch[1]) || 0;
            result.y = parseFloat(translateMatch[2]) || 0;
        }
        return result;
    }

    addControls() {
        const mainContainer = this.containers[0];
        d3.select(mainContainer).select('.container-zoom-controls').remove();

        const controls = d3.select(mainContainer)
            .append('div')
            .attr('class', 'container-zoom-controls')
            .style('position', 'absolute')
            .style('top', '5px')
            .style('right', '5px')
            .style('display', 'flex')
            .style('gap', '5px')
            .style('z-index', '20');

        controls.append('button')
            .text('+')
            .style('padding', '2px 6px')
            .style('font-size', '12px')
            .style('cursor', 'pointer')
            .on('click', () => {
                this.zoomIn();
            });

        controls.append('button')
            .text('-')
            .style('padding', '2px 6px')
            .style('font-size', '12px')
            .style('cursor', 'pointer')
            .on('click', () => {
                this.zoomOut();
            });

        controls.append('button')
            .text('⟲')
            .style('padding', '2px 6px')
            .style('font-size', '12px')
            .style('cursor', 'pointer')
            .on('click', () => {
                this.reset();
            });
    }

    zoomIn() {
        this.svgs[0]
            .transition()
            .duration(250)
            .call(this.zoom.scaleBy, 1.5);
    }

    zoomOut() {
        this.svgs[0]
            .transition()
            .duration(250)
            .call(this.zoom.scaleBy, 0.75);
    }

    reset() {
        this.svgs[0]
            .transition()
            .duration(250)
            .call(this.zoom.transform, d3.zoomIdentity);

        this.initialTransforms.forEach((initialTransform, graphElement) => {
            d3.select(graphElement).attr('transform', initialTransform);
        });
    }
}

const baseUrl = 'http://localhost:5104/api/npyfiles';
let currentDoctorId = null;
let currentRecord = null;
let fullEcgData = null;
let fullSignalData = null;
let selectedChannelIndex = null;
let containerZoomHandlers = [];
let controlsInitialized = false;
const displaySeconds = 6;
const LINE_WIDTH = 0.7;

let ecgPointSelectionActive = false;
let currentSelectedPoint = null;
let currentSelectedWaveType = 'P';
let currentSelectedPointData = null;

function formatFileSize(bytes) {
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

function getSignalType(type) {
    const types = {
        1: 'ЭКГ',
        2: 'ММГ',
        3: 'ЭЭГ'
    };
    return types[type] || `Тип ${type}`;
}

function showError(message) {
    alert('Ошибка: ' + message);
}

async function loadParsedEcgData(recordId) {
    try {
        const response = await authService.apiRequest(`${baseUrl}/ecg-data/${recordId}`);
        if (response && response.ok) {
            const responseText = await response.text();
            const ecgData = JSON.parse(responseText);

            if (!ecgData.channels || !Array.isArray(ecgData.channels)) {
                showError('Данные каналов не получены');
                return;
            }

            fullEcgData = {
                channels: ecgData.channels,
                channelNames: ecgData.channelNames,
                samplingRate: 500
            };

            displayAllChannelsD3(fullEcgData.channels, fullEcgData.channelNames);
            initFullSignalControls();
            initializeIndividualZooms();
        } else {
            showError('Failed to load ECG data');
        }
    } catch (error) {
        showError('Ошибка загрузки данных ЭКГ: ' + error.message);
    }
}

function initializeIndividualZooms() {
    containerZoomHandlers = [];
    setTimeout(() => {
        const upperHandler = new ContainerZoomHandler(['standard-leads', 'chest-leads']);
        containerZoomHandlers.push(upperHandler);
    }, 100);
}

function displayAllChannelsD3(channels, channelNames) {
    renderEcgOnGrids(channels, channelNames, 500, displaySeconds);
}

async function loadDoctorRecords() {
    try {
        if (!currentDoctorId) {
            await loadCurrentDoctor();
        }

        const response = await authService.apiRequest(`${baseUrl}/doctor-records/${currentDoctorId}`);

        if (response && response.ok) {
            const records = await response.json();
            displayRecords(records);
            return records;
        } else {
            showError('Не удалось загрузить список записей');
        }
    } catch (error) {
        showError('Ошибка при загрузке списка записей');
    }
}

async function loadCurrentDoctor() {
    try {
        const user = await authService.getCurrentUser();
        if (user && user.idDoctor) {
            currentDoctorId = user.idDoctor;
            return user;
        } else {
            showError('Не удалось загрузить данные врача');
        }
    } catch (error) {
        showError('Ошибка при загрузке данных врача');
    }
}

async function loadRecord(recordId) {
    try {
        const infoResponse = await authService.apiRequest(`${baseUrl}/info/${recordId}`);
        if (infoResponse && infoResponse.ok) {
            const recordInfo = await infoResponse.json();
            currentRecord = recordInfo;
            displayRecordParams(recordInfo);
            highlightActiveRecord(recordId);
            await loadParsedEcgData(recordId);
        }
    } catch (error) {
        showError('Ошибка при загрузке записи: ' + error.message);
    }
}

function initFullSignalControls() {
    const select = document.getElementById('fullSignalChannelSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Выберите канал --</option>';

    if (fullEcgData && fullEcgData.channelNames) {
        fullEcgData.channelNames.forEach((name, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    if (!controlsInitialized) {
        select.addEventListener('change', (e) => {
            selectFullSignalChannel(e.target.value);
        });
        controlsInitialized = true;
    }
}

function selectFullSignalChannel(channelIndex) {
    if (channelIndex === "") {
        clearFullSignalDisplay();
        return;
    }

    if (!fullEcgData) {
        return;
    }

    selectedChannelIndex = parseInt(channelIndex);
    displayFullSignal();
}

function displayFullSignal() {
    if (!fullEcgData || selectedChannelIndex === null) return;

    const channelData = fullEcgData.channels[selectedChannelIndex];
    const channelName = fullEcgData.channelNames[selectedChannelIndex];

    fullSignalData = {
        data: channelData,
        name: channelName,
        samplingRate: fullEcgData.samplingRate,
        totalDuration: channelData.length / fullEcgData.samplingRate
    };

    renderFullSignal();
}

function renderFullSignal() {
    const container = document.querySelector('#bottom-lead');
    if (!container || !fullSignalData) return;

    let svg = d3.select(container).select('svg');

    const graphGroup = svg.select('.ecg-graph');

    graphGroup.selectAll('.ecg-line').remove();

    graphGroup.selectAll('text').remove();

    const width = parseInt(svg.attr('width'));
    const height = parseInt(svg.attr('height'));


    graphGroup.append('text')
        .attr('x', 5)
        .attr('y', 15)
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(fullSignalData.name);

    graphGroup.append('text')
        .attr('x', width - 25)
        .attr('y', height / 2 - 5)
        .attr('font-size', '10px')
        .attr('fill', '#2c6fbb')
        .text('0 мВ');
    renderFullSignalLine(graphGroup, parseInt(svg.attr('width')), parseInt(svg.attr('height')));
}

function renderFullSignalLine(graphGroup, width, height) {
    const data = fullSignalData.data;
    const samplingRate = fullSignalData.samplingRate;

    const totalDuration = data.length / samplingRate;

    const dataWidth = 125 * totalDuration;

    const displayData = data.map((value, index) => {
        const x = (index / samplingRate) * 125; 
        const limitedX = Math.min(x, dataWidth - 1);
        const y = (height / 2) - (value * 50);
        return { x: limitedX, y };
    });

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "ecg-tooltip")
        .style("opacity", 0);

    const lineGenerator = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveMonotoneX);

    graphGroup.append('path')
        .datum(displayData)
        .attr('d', lineGenerator)
        .attr('fill', 'none')
        .attr('stroke', '#2c6fbb')
        .attr('stroke-width', LINE_WIDTH)
        .attr('stroke-linecap', 'round')
        .attr('class', 'ecg-line');

    graphGroup.selectAll('.ecg-point')
        .data(displayData.filter((d, i) => i % 50 === 0))
        .enter().append('circle')
        .attr('class', 'ecg-point')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 4)
        .style('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
            tooltip
                .style('opacity', 1)
                .html(`
                    <strong>${channelName}</strong><br>
                    Время: ${d.time} сек<br>
                    Значение: ${d.value.toFixed(4)} мВ
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 15) + 'px');
        })
        .on('mousemove', function (event) {
            tooltip
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 15) + 'px');
        })
        .on('mouseout', function () {
            tooltip.style('opacity', 0);
        });
}

function clearFullSignalDisplay() {
    const container = document.querySelector('#bottom-lead');
    if (!container) return;

    const svg = container.querySelector('svg');
    if (svg) {
        const graphGroup = svg.querySelector('.ecg-graph');
        if (graphGroup) {
            d3.select(graphGroup).selectAll('.ecg-line').remove();
        }
    }
}

function displayRecordParams(record) {
    const paramsContent = document.getElementById('paramsData');
    if (!paramsContent) return;

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
                <div class="param-value">${getSignalType(record.type)}</div>
            </div>
        </div>
    `;
}

function displayRecords(records) {
    const recordsList = document.getElementById('recordsList');
    if (!recordsList) return;

    if (!records || records.length === 0) {
        recordsList.innerHTML = `
            <div class="no-data">
                <div>Записей не найдено</div>
            </div>
        `;
        return;
    }

    recordsList.innerHTML = records.map(record => `
        <div class="record-card" onclick="loadRecord(${record.recordId})" 
             id="record-${record.recordId}">
            <div class="record-header">ЭКГ #${record.recordId}</div>
            <div class="record-meta">
                ${new Date(record.uploadedAt).toLocaleDateString('ru-RU')} 
                ${new Date(record.uploadedAt).toLocaleTimeString('ru-RU')}
            </div>
            <div class="record-meta">${formatFileSize(record.fileSize)}</div>
        </div>
    `).join('');
}

function highlightActiveRecord(recordId) {
    document.querySelectorAll('.record-card').forEach(card => {
        card.classList.remove('active');
    });

    const activeCard = document.getElementById(`record-${recordId}`);
    if (activeCard) {
        activeCard.classList.add('active');
    }
}

// Обработчики событий
async function handleLogout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        await authService.logout();
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        await loadDoctorRecords();
        setTimeout(createEcgGrids, 500);
    } catch (error) {
        console.error('Initial load failed:', error);
    }
});

window.addEventListener('resize', function () {
    createEcgGrids();
});

// Функции создания сеток
function createEcgGrids() {
    try {
        createGridForContainer('standard-leads', ['I', 'II', 'III', 'aVR', 'aVL', 'aVF']);
        createGridForContainer('chest-leads', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
        createBottomGrid();
        setTimeout(() => {
            initializeIndividualZooms();
        }, 200);
    } catch (error) {
        console.error('Ошибка создания сеток:', error);
    }
}

function createBottomGrid() {
    const container = document.getElementById('bottom-lead');
    const containerRect = container.getBoundingClientRect();
    const width = Math.floor(containerRect.width);
    const height = Math.floor(containerRect.height);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#ffffff');

    const graphGroup = svg.append('g')
        .attr('class', 'ecg-graph graph-single');

    createFullSizeGrid(graphGroup, width, height, 'Доп данные');
}

function createFullSizeGrid(graphGroup, width, height, channelName) {
    const CELL_SIZE = 25;
    const SMALL_CELLS = 5;
    const smallGrid = CELL_SIZE / SMALL_CELLS;
    const mediumGrid = CELL_SIZE;

    for (let x = 0; x <= width; x += smallGrid) {
        graphGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let y = 0; y <= height; y += smallGrid) {
        graphGroup.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let x = 0; x <= width; x += mediumGrid) {
        graphGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    for (let y = 0; y <= height; y += mediumGrid) {
        graphGroup.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    const zeroLineY = height / 2;
    graphGroup.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', zeroLineY).attr('y2', zeroLineY)
        .attr('stroke', '#2c6fbb')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
}

function createGridForContainer(containerId, channelNames) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const width = Math.floor(containerRect.width);
    const height = Math.floor(containerRect.height);

    const existingControls = container.querySelector('.container-zoom-controls');

    container.innerHTML = '';

    if (existingControls) {
        container.appendChild(existingControls);
    }

    const graphHeight = Math.floor(height / channelNames.length);
    const totalUsedHeight = graphHeight * channelNames.length;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', totalUsedHeight)
        .attr('viewBox', `0 0 ${width} ${totalUsedHeight}`)
        .style('background', '#ffffff');

    channelNames.forEach((channelName, index) => {
        const yOffset = index * graphHeight;
        const graphGroup = svg.append('g')
            .attr('class', `ecg-graph graph-${index}`)
            .attr('transform', `translate(0, ${yOffset})`);

        createSingleGrid(graphGroup, width, graphHeight, channelName);
    });
}

function createSingleGrid(graphGroup, width, height, channelName) {
    const CELL_SIZE = 25;
    const SMALL_CELLS = 5;
    const smallGrid = CELL_SIZE / SMALL_CELLS;
    const mediumGrid = CELL_SIZE;

    for (let x = 0; x <= width; x += smallGrid) {
        graphGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let y = 0; y <= height; y += smallGrid) {
        graphGroup.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let x = 0; x <= width; x += mediumGrid) {
        graphGroup.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    for (let y = 0; y <= height; y += mediumGrid) {
        graphGroup.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y).attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    const zeroLineY = height / 2;
    graphGroup.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', zeroLineY).attr('y2', zeroLineY)
        .attr('stroke', '#2c6fbb')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');

    graphGroup.append('text')
        .attr('x', 5)
        .attr('y', 15)
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(channelName);

    graphGroup.append('text')
        .attr('x', width - 25)
        .attr('y', zeroLineY - 5)
        .attr('font-size', '10px')
        .attr('fill', '#2c6fbb')
        .text('0 мВ');
}

function renderEcgOnGrids(channelsData, channelNames, samplingRate = 500, displaySeconds = 4) {
    const graphContainers = document.querySelectorAll('#standard-leads, #chest-leads');
    const totalPointsToDisplay = samplingRate * displaySeconds;

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "ecg-tooltip")
        .style("opacity", 0);

    graphContainers.forEach((container, containerIndex) => {
        const svg = container.querySelector('svg');
        if (!svg) return;

        const graphs = svg.querySelectorAll('.ecg-graph');
        graphs.forEach((graphGroup, graphIndex) => {
            const globalIndex = containerIndex * 6 + graphIndex;
            if (globalIndex >= channelsData.length) return;

            const channelData = channelsData[globalIndex];
            const channelName = channelNames[globalIndex];
            const graphRect = graphGroup.getBoundingClientRect();
            const height = graphRect.height;

            // Очищаем предыдущие элементы
            d3.select(graphGroup).selectAll('.ecg-line').remove();
            d3.select(graphGroup).selectAll('.ecg-point').remove();

            const dataWidth = 125 * displaySeconds;

            const displayData = channelData.slice(0, totalPointsToDisplay).map((originalValue, index) => {
                const timeInSeconds = index / samplingRate;
                const x = timeInSeconds * 125;
                const limitedX = Math.min(x, dataWidth - 1);
                const y = (height / 2) - (originalValue * 50);
                return {
                    x: limitedX,
                    y,
                    value: originalValue,
                    time: timeInSeconds.toFixed(2),
                    channel: channelName
                };
            });

            const lineGenerator = d3.line()
                .x(d => d.x)
                .y(d => d.y)
                .curve(d3.curveMonotoneX);

            d3.select(graphGroup).append('path')
                .datum(displayData)
                .attr('d', lineGenerator)
                .attr('fill', 'none')
                .attr('stroke', '#2c6fbb')
                .attr('stroke-width', LINE_WIDTH)
                .attr('stroke-linecap', 'round')
                .attr('class', 'ecg-line');

            d3.select(graphGroup).selectAll('.ecg-point')
                .data(displayData)
                .enter().append('circle')
                .attr('class', 'ecg-point')
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 4)
                .style('fill', 'transparent')
                .style('cursor', 'pointer')
                .on('mouseover', function (event, d) {
                    if (!ecgPointSelectionActive) {
                        tooltip
                            .style('opacity', 1)
                            .html(`
                                <strong>${d.channel}</strong><br>
                                Время: ${d.time} сек<br>
                                Амплитуда: ${d.value.toFixed(4)} мВ
                            `)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 15) + 'px');
                    }
                })
                .on('mousemove', function (event) {
                    if (!ecgPointSelectionActive) {
                        tooltip
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 15) + 'px');
                    }
                })
                .on('mouseout', function () {
                    if (!ecgPointSelectionActive) {
                        tooltip.style('opacity', 0);
                    }
                });
        });
    });
}


document.addEventListener('DOMContentLoaded', function () {
    const waveSwitchers = document.querySelectorAll('input[name="wave-type"]');

    waveSwitchers.forEach(switcher => {
        switcher.addEventListener('change', function () {
            if (this.checked) {
                const selectedWave = this.value;
                handleWaveSelection(selectedWave);
            }
        });
    });
});

function initializePointSelection() {
    ecgPointSelectionActive = true;
    document.body.style.cursor = 'crosshair';

    d3.selectAll('.ecg-graph')
        .selectAll('.ecg-point')
        .style('cursor', 'pointer')
        .on('click.point-selection', function (event, d) {
            if (!ecgPointSelectionActive) return;
            event.stopPropagation();
            selectPoint(this, d);
        });
    document.addEventListener('keydown', handleKeyPress);
}

function selectPoint(pointElement, pointData) {
    // Снимаем выделение с предыдущей точки
    if (currentSelectedPoint) {
        d3.select(currentSelectedPoint)
            .style('fill', 'transparent')
            .attr('r', 4);
    }

    // Выделяем новую точку
    currentSelectedPoint = pointElement;
    d3.select(pointElement)
        .style('fill', '#ff0000')
        .attr('r', 3);

    // Сохраняем данные точки
    currentSelectedPointData = pointData;

    // Получаем название отведения
    const graphGroup = pointElement.closest('.ecg-graph');
    const channelName = d3.select(graphGroup).select('text').text();

    // Обновляем предварительный просмотр в таблице
    updateMarkupPreview({
        type: currentSelectedWaveType,
        lead: channelName,
        value: pointData.value.toFixed(4),
        time: pointData.time,
        comment: ''
    });
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && ecgPointSelectionActive && currentSelectedPoint) {
        confirmPointSelection();
    }

    if (event.key === 'Escape' && ecgPointSelectionActive) {
        cancelPointSelection();
    }
}

function confirmPointSelection() {
    if (!currentSelectedPoint || !currentSelectedPointData) return;

    // Получаем комментарий если есть
    const commentInput = document.getElementById('previewComment');
    const comment = commentInput ? commentInput.value : '';

    // Получаем название отведения
    const graphGroup = currentSelectedPoint.closest('.ecg-graph');
    const channelName = d3.select(graphGroup).select('text').text();

    // Создаем запись разметки
    const markupRecord = {
        type: currentSelectedWaveType,
        lead: channelName,
        value: parseFloat(currentSelectedPointData.value.toFixed(4)),
        time: currentSelectedPointData.time + ' сек',
        comment: comment
    };

    // Добавляем запись в таблицу
    addMarkupToTable(markupRecord);

    // Убираем галочку с чекбокса
    document.getElementById('markupModeToggle').checked = false;

    // Сбрасываем выделение
    resetPointSelection();
}

function cancelPointSelection() {
    resetPointSelection();
}

function resetPointSelection() {
    // Снимаем выделение с точки
    if (currentSelectedPoint) {
        d3.select(currentSelectedPoint)
            .style('fill', 'transparent')
            .attr('r', 4);
    }

    // Сбрасываем состояние
    ecgPointSelectionActive = false;
    currentSelectedPoint = null;
    currentSelectedPointData = null;
    document.body.style.cursor = '';

    // Удаляем обработчики
    d3.selectAll('.ecg-point')
        .on('click.point-selection', null)
        .style('cursor', '');

    // Удаляем кнопку Done
    d3.select('.ecg-done-button').remove();

    // Удаляем обработчик клавиш
    document.removeEventListener('keydown', handleKeyPress);

    // Очищаем предварительный просмотр
    clearMarkupPreview();
}

function updateMarkupPreview(markupData) {
    let previewElement = document.getElementById('markupPreview');
    if (!previewElement) {
        const tableBody = document.getElementById('markupTableBody');
        previewElement = document.createElement('tr');
        previewElement.id = 'markupPreview';
        previewElement.style.backgroundColor = '#fffacd';
        tableBody.appendChild(previewElement);
    }

    previewElement.innerHTML = `
        <td>${markupData.type}</td>
        <td>${markupData.lead}</td>
        <td>${markupData.value}</td>
        <td>${markupData.time}</td>
        <td>
            <input type="text" id="previewComment" placeholder="Введите комментарий" 
                   style="padding: 2px; font-size: 12px; width: 100%;"
                   value="${markupData.comment}">
            <div style="margin-top: 5px;">
                <button onclick="confirmPointSelection()" style="font-size: 10px; padding: 2px 5px;">✓</button>
                <button onclick="resetPointSelection()" style="font-size: 10px; padding: 2px 5px;">✗</button>
            </div>
        </td>
    `;
}

function clearMarkupPreview() {
    const previewElement = document.getElementById('markupPreview');
    if (previewElement) {
        previewElement.remove();
    }
}

let markupData = [];

function addMarkupToTable(markupRecord) {
    markupData.push(markupRecord);
    updateMarkupTable(markupData);
}

function updateMarkupTable(markupData) {
    const tableBody = document.getElementById('markupTableBody');

    if (!markupData || markupData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-markup">Нет данных о разметке</td></tr>';
        return;
    }

    let html = '';
    markupData.forEach((item, index) => {
        html += `
            <tr>
                <td>${item.type || ''}</td>
                <td>${item.lead || ''}</td>
                <td>${item.value || ''}</td>
                <td>${item.time || ''}</td>
                <td>${item.comment || ''}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Обработчик выбора типа волны
function handleWaveSelection(waveType) {
    currentSelectedWaveType = waveType;
}

function toggleMarkupMode(enable) {
    if (enable) {
        initializePointSelection();
    } else {
        resetPointSelection();
    }
}

// Модифицируем обработчики радио-кнопок
document.addEventListener('DOMContentLoaded', function () {
    const waveSwitchers = document.querySelectorAll('input[name="wave-type"]');

    waveSwitchers.forEach(switcher => {
        switcher.addEventListener('change', function () {
            if (this.checked) {
                const selectedWave = this.value;
                console.log('Выбрана волна:', selectedWave);
                handleWaveSelection(selectedWave);
            }
        });
    });

    const markupToggle = document.getElementById('markupModeToggle');
    if (markupToggle) {
        markupToggle.addEventListener('change', function () {
            toggleMarkupMode(this.checked);
        });
    }
});