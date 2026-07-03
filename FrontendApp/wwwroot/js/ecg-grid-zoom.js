const displaySeconds = 6;
const LINE_WIDTH = 0.7;

let containerZoomHandlers = [];
let bottomZoomHandler = null;
let currentZoomState = null;

function refreshAllDisplays(resetZoomState = false) {
    if (!fullEcgData) return;

    clearEcgCurves();

    if (!resetZoomState && containerZoomHandlers[0]) {
        currentZoomState = d3.zoomTransform(containerZoomHandlers[0].svgs[0].node());
    } else {
        currentZoomState = null;
    }

    destroyZoomHandlers();
    createEcgGrids();

    setTimeout(() => {
        displayAllChannelsD3();

        if (selectedChannelIndex !== null && fullSignalData) {
            displayBottomGraph();
        }

        initZoomHandlers();

        if (currentZoomState && containerZoomHandlers[0]) {
            setTimeout(() => {
                try {
                    containerZoomHandlers[0].svgs[0]
                        .call(containerZoomHandlers[0].zoom.transform, currentZoomState);
                } catch (e) { }
            }, 150);
        }
    }, 100);
}

function destroyZoomHandlers() {
    containerZoomHandlers.forEach(handler => {
        if (handler && handler.destroy) handler.destroy();
    });
    containerZoomHandlers = [];

    if (bottomZoomHandler) {
        bottomZoomHandler.destroy();
        bottomZoomHandler = null;
    }
}

function initZoomHandlers() {
    const standardLeads = document.getElementById('standard-leads');
    const chestLeads = document.getElementById('chest-leads');

    if (standardLeads && chestLeads) {
        containerZoomHandlers = [new ContainerZoomHandler(['standard-leads', 'chest-leads'])];
    }

    const bottomLead = document.getElementById('bottom-lead');
    if (bottomLead && bottomLead.querySelector('svg')) {
        bottomZoomHandler = new BottomZoomHandler('bottom-lead');
    }
}

function resetZoom() {
    containerZoomHandlers.forEach(handler => {
        if (handler && handler.svgs[0]) {
            handler.svgs[0]
                .transition()
                .duration(250)
                .call(handler.zoom.transform, d3.zoomIdentity);
        }
        if (handler && handler.reset) handler.reset();
    });

    if (bottomZoomHandler) {
        bottomZoomHandler.reset();
    }

    currentZoomState = null;
}

class ContainerZoomHandler {
    constructor(containerIds) {
        this.containerIds = containerIds;
        this.containers = containerIds.map(id => document.getElementById(id)).filter(Boolean);
        this.svgs = [];
        this.zoom = null;
        this.zoomTransform = d3.zoomIdentity;
        this._clamping = false;

        if (!this.containers.length) return;
        this.init();
    }

    init() {
        this.containers.forEach(container => {
            const svg = d3.select(container).select('svg');
            if (!svg.empty()) this.svgs.push(svg);
        });
        if (!this.svgs.length) return;
        this.updateSizes();
        this.initZoom();
        this.addControls();
    }

    updateSizes() {
        if (!this.svgs.length) return;
        const rect = this.svgs[0].node().getBoundingClientRect();
        this.svgWidth = rect.width;
        this.svgHeight = rect.height;
        this.contentWidth = this.svgWidth;
        this.contentHeight = this.svgHeight;
    }

    initZoom() {
        if (this.zoom) {
            this.svgs.forEach(svg => svg.on('.zoom', null));
        }
        this.zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on('zoom', (e) => this.handleZoom(e));
        this.svgs.forEach(svg => {
            svg.call(this.zoom);
            svg.on("dblclick.zoom", null);
            svg.attr('transform', null);
        });
    }

    handleZoom(e) {
        if (window.ecgPointSelectionActive) return;

        this.svgs.forEach(svg => {
            svg.attr('transform', null);
        });

        let tx = e.transform.x;
        let ty = e.transform.y;
        let k = e.transform.k;

        const minTx = this.svgWidth - this.contentWidth * k;
        const maxTx = 0;
        if (this.contentWidth * k <= this.svgWidth) {
            tx = 0;
        } else {
            tx = Math.max(minTx, Math.min(maxTx, tx));
        }

        const minTy = this.svgHeight - this.contentHeight * k;
        const maxTy = 0;
        if (this.contentHeight * k <= this.svgHeight) {
            ty = 0;
        } else {
            ty = Math.max(minTy, Math.min(maxTy, ty));
        }

        if (tx !== e.transform.x || ty !== e.transform.y || k !== e.transform.k) {
            if (!this._clamping) {
                this._clamping = true;
                const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
                this.svgs[0].call(this.zoom.transform, newTransform);
                this._clamping = false;
            }
            return;
        }

        this.zoomTransform = e.transform;

        this.containers.forEach(container => {
            const graphs = container.querySelectorAll('.ecg-graph');
            graphs.forEach(g => {
                const baseX = parseFloat(g.getAttribute('data-initial-x') || '0');
                const baseY = parseFloat(g.getAttribute('data-initial-y') || '0');
                const newX = this.zoomTransform.x + baseX * this.zoomTransform.k;
                const newY = this.zoomTransform.y + baseY * this.zoomTransform.k;
                d3.select(g).attr('transform', `translate(${newX},${newY}) scale(${this.zoomTransform.k})`);
            });
        });
    }

    reset() {
        this.containers.forEach(container => {
            const graphs = container.querySelectorAll('.ecg-graph');
            graphs.forEach(g => {
                const baseX = parseFloat(g.getAttribute('data-initial-x') || '0');
                const baseY = parseFloat(g.getAttribute('data-initial-y') || '0');
                d3.select(g).attr('transform', `translate(${baseX},${baseY}) scale(1)`);
            });
        });
    }

    addControls() { }
    destroy() { }
}

class BottomZoomHandler {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.zoom = null;
        this._clamping = false;

        if (!this.container) return;
        this.init();
    }

    init() {
        this.svg = d3.select(this.container).select('svg');
        if (this.svg.empty()) return;
        this.updateSizes();
        this.initZoom();
        this.addControls();
    }

    updateSizes() {
        const rect = this.svg.node().getBoundingClientRect();
        this.svgWidth = rect.width;
        this.svgHeight = rect.height;
        this.contentWidth = this.svgWidth;
        this.contentHeight = this.svgHeight;
    }

    initZoom() {
        if (this.svg) this.svg.on('.zoom', null);
        this.zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on('zoom', (e) => this.handleZoom(e));
        this.svg.call(this.zoom);
        this.svg.on("dblclick.zoom", null);
        this.svg.attr('transform', null);
    }

    handleZoom(e) {
        if (window.ecgPointSelectionActive) return;

        this.svg.attr('transform', null);

        let tx = e.transform.x;
        let ty = e.transform.y;
        let k = e.transform.k;

        const minTx = this.svgWidth - this.contentWidth * k;
        const maxTx = 0;
        if (this.contentWidth * k <= this.svgWidth) {
            tx = 0;
        } else {
            tx = Math.max(minTx, Math.min(maxTx, tx));
        }

        const minTy = this.svgHeight - this.contentHeight * k;
        const maxTy = 0;
        if (this.contentHeight * k <= this.svgHeight) {
            ty = 0;
        } else {
            ty = Math.max(minTy, Math.min(maxTy, ty));
        }

        if (tx !== e.transform.x || ty !== e.transform.y || k !== e.transform.k) {
            if (!this._clamping) {
                this._clamping = true;
                const newTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
                this.svg.call(this.zoom.transform, newTransform);
                this._clamping = false;
            }
            return;
        }

        const g = d3.select(this.container).select('g.ecg-graph');
        if (!g.empty()) {
            const baseX = parseFloat(g.attr('data-initial-x') || '0');
            const baseY = parseFloat(g.attr('data-initial-y') || '0');
            const newX = tx + baseX * k;
            const newY = ty + baseY * k;
            g.attr('transform', `translate(${newX},${newY}) scale(${k})`);
        }
    }

    reset() {
        const g = d3.select(this.container).select('g.ecg-graph');
        if (!g.empty()) {
            const baseX = parseFloat(g.attr('data-initial-x') || '0');
            const baseY = parseFloat(g.attr('data-initial-y') || '0');
            g.attr('transform', `translate(${baseX},${baseY}) scale(1)`);
        }
        if (this.svg) {
            this.svg.call(this.zoom.transform, d3.zoomIdentity);
        }
    }

    addControls() { }
    destroy() { }
}

function clearEcgCurves() {
    const selector = '#standard-leads svg .ecg-line, #chest-leads svg .ecg-line, #standard-leads svg .ecg-point, #chest-leads svg .ecg-point';
    document.querySelectorAll(selector).forEach(el => el.remove());
}

function displayAllChannelsD3() {
    if (!fullEcgData) return;

    clearEcgCurves();

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "ecg-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "8px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

    const containers = document.querySelectorAll('#standard-leads, #chest-leads');

    containers.forEach((container, ci) => {
        const svg = container.querySelector('svg');
        if (!svg) return;

        const graphs = svg.querySelectorAll('.ecg-graph');

        graphs.forEach((g, gi) => {
            const idx = ci * 6 + gi;
            if (idx >= fullEcgData.channels.length) return;

            d3.select(g).selectAll('.ecg-line, .ecg-point').remove();

            const data = fullEcgData.channels[idx]
                .slice(0, 500 * displaySeconds)
                .map((v, i) => ({
                    x: Math.min((i / 500) * 125, 125 * displaySeconds - 1),
                    y: g.getBoundingClientRect().height / 2 - v * 50,
                    value: v,
                    channel: fullEcgData.channelNames[idx],
                    index: i
                }));

            d3.select(g)
                .append('path')
                .datum(data)
                .attr('class', 'ecg-line')
                .attr('d', d3.line()
                    .x(d => d.x)
                    .y(d => d.y)
                    .curve(d3.curveMonotoneX))
                .attr('fill', 'none')
                .attr('stroke', '#2c6fbb')
                .attr('stroke-width', LINE_WIDTH);

            d3.select(g)
                .selectAll('.ecg-point')
                .data(data)
                .enter()
                .append('circle')
                .attr('class', 'ecg-point')
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 4)
                .style('fill', 'transparent')
                .style('stroke', 'none')
                .style('stroke-width', '0')
                .style('cursor', 'pointer')
                .on('mouseover', (e, d) => {
                    if (!window.ecgPointSelectionActive) {
                        tooltip
                            .style('opacity', 1)
                            .html(`<strong>${d.channel}</strong><br>Амплитуда: ${d.value.toFixed(4)} мВ`)
                            .style('left', (e.pageX + 10) + 'px')
                            .style('top', (e.pageY - 15) + 'px');
                    }
                })
                .on('mousemove', e => {
                    if (!window.ecgPointSelectionActive) {
                        tooltip
                            .style('left', (e.pageX + 10) + 'px')
                            .style('top', (e.pageY - 15) + 'px');
                    }
                })
                .on('mouseout', () => tooltip.style('opacity', 0));
        });
    });
}

function displayBottomGraph() {
    if (!fullSignalData) return;

    const container = document.getElementById('bottom-lead');
    if (!container) return;

    d3.select(container).selectAll('*').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#ffffff');

    const g = svg.append('g')
        .attr('class', 'ecg-graph graph-single')
        .attr('data-initial-x', 0)
        .attr('data-initial-y', 0);

    createFullSizeGrid(g, width, height);

    g.append('text')
        .attr('x', 10)
        .attr('y', 20)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text(fullSignalData.name);

    const totalPoints = fullSignalData.data.length;
    const timeScale = width / totalPoints;

    const data = fullSignalData.data.map((v, i) => ({
        x: i * timeScale,
        y: height / 2 - v * (height / 5),
        value: v,
        channel: fullSignalData.name,
        index: i
    }));

    g.append('path')
        .datum(data)
        .attr('class', 'ecg-line')
        .attr('d', d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveMonotoneX))
        .attr('fill', 'none')
        .attr('stroke', '#2c6fbb')
        .attr('stroke-width', LINE_WIDTH);

    let tooltip = d3.select("body").select(".ecg-tooltip-bottom");
    if (tooltip.empty()) {
        tooltip = d3.select("body")
            .append("div")
            .attr("class", "ecg-tooltip-bottom")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("padding", "8px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");
    }

    g.selectAll('.ecg-point-bottom')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'ecg-point-bottom ecg-point')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 4)
        .style('fill', 'transparent')
        .style('stroke', 'none')
        .style('stroke-width', '0')
        .style('cursor', 'pointer')
        .on('mouseover', (e, d) => {
            if (!window.ecgPointSelectionActive) {
                tooltip
                    .style('opacity', 1)
                    .html(`<strong>${d.channel}</strong><br>Амплитуда: ${d.value.toFixed(4)} мВ`)
                    .style('left', (e.pageX + 10) + 'px')
                    .style('top', (e.pageY - 15) + 'px');
            }
        })
        .on('mousemove', e => {
            if (!window.ecgPointSelectionActive) {
                tooltip
                    .style('left', (e.pageX + 10) + 'px')
                    .style('top', (e.pageY - 15) + 'px');
            }
        })
        .on('mouseout', () => tooltip.style('opacity', 0))
        .on('click', function (e, d) {
            if (!window.ecgPointSelectionActive) return;
            e.stopPropagation();

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

                const channel = fullSignalData.name;

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
                    <td>${d.value.toFixed(4)}</td>
                    <td style="color:#888;">ожидание второй точки</td>
                    <td>
                        <input type="text" id="previewComment" placeholder="Введите комментарий" style="padding:2px;font-size:12px;width:100%;">
                        <div style="margin-top:5px;">
                            <button onclick="saveSinglePoint()" style="font-size:10px;padding:2px 5px;background-color:#4CAF50;color:white;border:none;border-radius:2px;">✓</button>
                            <button onclick="cancelPointSelection()" style="font-size:10px;padding:2px 5px;">✗</button>
                        </div>
                    </td>`;

            } else {
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

                const channel = fullSignalData.name;

                markupData.push({
                    type: currentSelectedWaveType,
                    lead: channel,
                    value1: +firstPointData.value.toFixed(4),
                    value2: +secondPointData.value.toFixed(4),
                    comment: document.getElementById('previewComment')?.value || ''
                });

                updateMarkupTable();
                clearSelection();
            }
        });

    if (!window.bottomGraphKeyHandler) {
        window.bottomGraphKeyHandler = true;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && firstPointSelected && !secondPointData) {
                if (firstPointElement && firstPointElement.classList.contains('ecg-point-bottom')) {
                    markupData.push({
                        type: currentSelectedWaveType,
                        lead: fullSignalData.name,
                        value1: +firstPointData.value.toFixed(4),
                        value2: 0,
                        comment: (document.getElementById('previewComment')?.value || '') + ' (только одна точка)'
                    });
                    updateMarkupTable();
                    clearSelection();
                }
            }
        });
    }

    if (bottomZoomHandler) {
        bottomZoomHandler.destroy();
    }
    bottomZoomHandler = new BottomZoomHandler('bottom-lead');
}

function clearBottomGraph() {
    const container = document.getElementById('bottom-lead');
    if (container) {
        d3.select(container).selectAll('*').remove();
    }
    selectedChannelIndex = null;
    if (bottomZoomHandler) {
        bottomZoomHandler.destroy();
        bottomZoomHandler = null;
    }
}

function createEcgGrids() {
    const standardLeads = document.getElementById('standard-leads');
    const chestLeads = document.getElementById('chest-leads');
    const bottomLead = document.getElementById('bottom-lead');

    if (standardLeads) {
        const controls = standardLeads.querySelector('.container-zoom-controls');
        standardLeads.innerHTML = '';
        if (controls) standardLeads.appendChild(controls);
    }

    if (chestLeads) {
        chestLeads.innerHTML = '';
    }

    if (bottomLead) {
        bottomLead.innerHTML = '';
    }

    createGridForContainer('standard-leads', ['I', 'II', 'III', 'aVR', 'aVL', 'aVF']);
    createGridForContainer('chest-leads', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
    createBottomGrid();
}

function createBottomGrid() {
    const container = document.getElementById('bottom-lead');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    d3.select(container).selectAll('*').remove();

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#ffffff');

    const g = svg.append('g')
        .attr('class', 'ecg-graph graph-single')
        .attr('data-initial-x', 0)
        .attr('data-initial-y', 0);

    createFullSizeGrid(g, width, height);
}

function createFullSizeGrid(g, width, height, step = 25) {
    const smallStep = step / 5;
    const largeStep = step;

    for (let x = 0; x <= width; x += smallStep) {
        g.append('line')
            .attr('x1', x)
            .attr('x2', x)
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let y = 0; y <= height; y += smallStep) {
        g.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', y)
            .attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.3);
    }

    for (let x = 0; x <= width; x += largeStep) {
        g.append('line')
            .attr('x1', x)
            .attr('x2', x)
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    for (let y = 0; y <= height; y += largeStep) {
        g.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', y)
            .attr('y2', y)
            .attr('stroke', '#e0e0e0')
            .attr('stroke-width', 0.5);
    }

    g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', height / 2)
        .attr('y2', height / 2)
        .attr('stroke', '#2c6fbb')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
}

function createGridForContainer(containerId, channelNames) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const graphHeight = Math.floor(rect.height / channelNames.length);

    const controls = containerId === 'standard-leads'
        ? container.querySelector('.container-zoom-controls')
        : null;

    container.innerHTML = '';

    if (controls) {
        container.appendChild(controls);
    }

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', graphHeight * channelNames.length)
        .attr('viewBox', `0 0 ${width} ${graphHeight * channelNames.length}`)
        .style('background', '#ffffff')
        .style('display', 'block');

    channelNames.forEach((name, index) => {
        const g = svg
            .append('g')
            .attr('class', `ecg-graph graph-${index}`)
            .attr('data-initial-x', 0)
            .attr('data-initial-y', index * graphHeight)
            .attr('transform', `translate(0,${index * graphHeight})`);

        createFullSizeGrid(g, width, graphHeight);

        g.append('text')
            .attr('x', 5)
            .attr('y', 15)
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(name);

        g.append('text')
            .attr('x', width - 25)
            .attr('y', graphHeight / 2 - 5)
            .attr('font-size', '10px')
            .attr('fill', '#2c6fbb')
            .text('0 мВ');
    });
}

window.addEventListener('load', () => {
    setTimeout(() => {
        createEcgGrids();
        if (fullEcgData) {
            displayAllChannelsD3();
            initZoomHandlers();
        }
    }, 100);
});