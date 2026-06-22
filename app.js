// Lógica del Simulador de Crecimiento Poblacional (Modelo Logístico y Exponencial)
// Diseñado para la simulación interactiva con un mapa regional y visualización en tiempo real.

let chartInstance = null;
let activeRegion = "center";
let simulationYears = 50;
let dt = 1; // Paso temporal de 1 año

// Datos demográficos base de cada región
const regionsData = {
    center: { name: "Región Centro (Urbana)", p0: 15000, r: 0.08, K: 90000 },
    north: { name: "Región Norte (Expansiva)", p0: 5000, r: 0.10, K: 150000 },
    south: { name: "Región Sur (Saturada)", p0: 35000, r: 0.04, K: 50000 },
    east: { name: "Región Este (Industrial)", p0: 8000, r: 0.12, K: 70000 },
    west: { name: "Región Oeste (Agrícola)", p0: 12000, r: 0.05, K: 110000 }
};

// Objeto para almacenar las trayectorias calculadas de todas las regiones
let regionsSimulations = {};

// Control de Animación
let animationInterval = null;
let currentSimulationYear = 0;
let isPlaying = false;


// 2. Selección de Regiones en el Mapa SVG
function selectRegion(regionId) {
    activeRegion = regionId;
    
    // Actualizar clases activas en SVG
    document.querySelectorAll('.map-region').forEach(el => el.classList.remove('active-region'));
    const activeEl = document.getElementById(`region-${regionId}`);
    if (activeEl) {
        activeEl.classList.add('active-region');
    }
    
    // Cargar datos en los inputs del panel
    const data = regionsData[regionId];
    const regionSelector = document.getElementById("region-selector");
    if (regionSelector) {
        regionSelector.value = regionId;
    }
    const activeBadge = document.getElementById("active-region-badge");
    if (activeBadge) {
        activeBadge.textContent = data.name;
    }
    document.getElementById("param-p0").value = data.p0;
    document.getElementById("param-r").value = data.r;
    document.getElementById("param-k").value = data.K;
    
    // Sincronizar texto de displays
    document.getElementById("val-p0").textContent = `${data.p0.toLocaleString()} hab`;
    document.getElementById("val-r").textContent = `${data.r.toFixed(3)} (${(data.r * 100).toFixed(1)}%)`;
    document.getElementById("val-k").textContent = `${data.K.toLocaleString()} hab`;
    
    updateSimulation(false); // Recalcular solo los datos
    resetAnimation(); // Reiniciar scrubber
}

// 3. Solucionador numérico RK4
function runEDOSolver(p0, r, K, model) {
    const time = [];
    const population = [];
    
    let t = 0;
    let P = p0;
    
    // Función diferencial dP/dt
    const f = (valP) => {
        if (model === 'logistic') {
            return r * valP * (1 - valP / K);
        } else {
            return r * valP; // Exponencial
        }
    };
    
    while (t <= simulationYears) {
        time.push(t);
        population.push(Math.round(P));
        
        // Método Runge-Kutta 4to Orden (RK4)
        let m1 = f(P);
        let m2 = f(P + 0.5 * m1 * dt);
        let m3 = f(P + 0.5 * m2 * dt);
        let m4 = f(P + m3 * dt);
        
        P = P + (dt / 6) * (m1 + 2 * m2 + 2 * m3 + m4);
        
        t += dt;
    }
    
    return { time, population };
}

// 4. Calcular simulación de todas las regiones
function calculateAllRegions() {
    const model = document.getElementById("growth-model").value;
    
    // Para la región activa, usar los valores de los sliders
    const activeP0 = parseFloat(document.getElementById("param-p0").value);
    const activeR = parseFloat(document.getElementById("param-r").value);
    const activeK = parseFloat(document.getElementById("param-k").value);
    
    // Actualizar nuestra base de datos local para la región activa
    regionsData[activeRegion].p0 = activeP0;
    regionsData[activeRegion].r = activeR;
    regionsData[activeRegion].K = activeK;
    
    // Calcular trayectorias para cada una
    Object.keys(regionsData).forEach(key => {
        const reg = regionsData[key];
        regionsSimulations[key] = runEDOSolver(reg.p0, reg.r, reg.K, model);
    });
}

// 5. Actualizar Simulación y Gráficos
function updateSimulation(resetAnim = true) {
    // Capturar valores de la interfaz
    const p0 = parseFloat(document.getElementById("param-p0").value);
    const r = parseFloat(document.getElementById("param-r").value);
    const K = parseFloat(document.getElementById("param-k").value);
    const model = document.getElementById("growth-model").value;
    
    // Actualizar displays de texto
    document.getElementById("val-p0").textContent = `${p0.toLocaleString()} hab`;
    document.getElementById("val-r").textContent = `${r.toFixed(3)} (${(r * 100).toFixed(1)}%)`;
    document.getElementById("val-k").textContent = `${K.toLocaleString()} hab`;
    
    // Recalcular trayectorias de todas las regiones
    calculateAllRegions();
    
    if (resetAnim) {
        resetAnimation();
    } else {
        scrubTime(currentSimulationYear);
    }
    
    renderChart(model, K);
}

// 6. Colorear Mapa según Densidad de Población (Heatmap Dinámico)
function updateMapHeatmap(year) {
    Object.keys(regionsData).forEach(key => {
        const sim = regionsSimulations[key];
        const reg = regionsData[key];
        
        if (sim && sim.population) {
            const popAtYear = sim.population[year] || sim.population[sim.population.length - 1];
            
            // Tasa de ocupación o densidad relativa (Población / K)
            let ratio = popAtYear / reg.K;
            if (ratio > 1.2) ratio = 1.2; // tope visual en caso de modelo exponencial
            
            // Interpolar color verde:
            // Rango de opacidades: de 0.08 (vacio) a 0.85 (saturado)
            const minOpacity = 0.08;
            const maxOpacity = 0.85;
            const currentOpacity = minOpacity + ratio * (maxOpacity - minOpacity);
            
            const pathEl = document.getElementById(`region-${key}`);
            if (pathEl) {
                // Si la región es la activa, mantendremos su borde blanco y un fill distintivo
                if (key === activeRegion) {
                    pathEl.style.fill = `rgba(16, 185, 129, ${Math.min(currentOpacity + 0.1, 0.95)})`;
                } else {
                    pathEl.style.fill = `rgba(16, 185, 129, ${currentOpacity})`;
                }
            }
        }
    });
}

// 7. Renderizar Gráfico (Chart.js)
function renderChart(model, K) {
    const ctx = document.getElementById('growthChart').getContext('2d');
    const activeData = regionsSimulations[activeRegion];
    
    const datasets = [
        {
            label: `${regionsData[activeRegion].name}`,
            data: activeData.population,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.15
        }
    ];
    
    // Si es logístico, agregar la línea de capacidad de carga K
    if (model === 'logistic') {
        const capacityLine = Array(simulationYears + 1).fill(K);
        datasets.push({
            label: 'Capacidad de Carga (K)',
            data: capacityLine,
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderDash: [8, 4],
            pointRadius: 0,
            fill: false
        });
        
        // Agregar también la línea de inflexión K/2
        const inflectionLine = Array(simulationYears + 1).fill(K / 2);
        datasets.push({
            label: 'Punto de Inflexión (K/2)',
            data: inflectionLine,
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
        });
    }
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: activeData.time,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tiempo (Años)',
                        color: '#94a3b8'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Población (Habitantes)',
                        color: '#94a3b8'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Inter' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// 8. Control de Scrubber e Hitos Temporales
function scrubTime(yearVal) {
    currentSimulationYear = parseInt(yearVal);
    document.getElementById("animation-scrubber").value = currentSimulationYear;
    document.getElementById("scrubber-current-time").textContent = `Año Seleccionado: ${currentSimulationYear}`;
    document.getElementById("stat-elapsed-years").textContent = `Año ${currentSimulationYear}`;
    
    // Obtener población del año para la región activa
    const activeSim = regionsSimulations[activeRegion];
    const pop = activeSim.population[currentSimulationYear];
    const reg = regionsData[activeRegion];
    
    document.getElementById("stat-current-pop").textContent = `${pop.toLocaleString()} hab`;
    
    // Calcular saturación porcentual (P/K)
    const sat = (pop / reg.K) * 100;
    document.getElementById("stat-saturation").textContent = `${sat.toFixed(1)}%`;
    
    // Colorear mapa
    updateMapHeatmap(currentSimulationYear);
    
    // Sincronizar indicador de gráfico
    if (chartInstance) {
        chartInstance.setActiveElements([{
            datasetIndex: 0,
            index: currentSimulationYear
        }]);
        chartInstance.tooltip.setActiveElements([{
            datasetIndex: 0,
            index: currentSimulationYear
        }], {x: 0, y: 0});
        chartInstance.update();
    }
}

let animationSpeed = 1;

function setSpeed(multiplier) {
    animationSpeed = multiplier;
    document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
    
    const speedBtn = document.getElementById(`speed-${multiplier}x`);
    if (speedBtn) {
        speedBtn.classList.add('active');
    }
    
    if (isPlaying) {
        clearInterval(animationInterval);
        startPlayInterval();
    }
}

function startPlayInterval() {
    animationInterval = setInterval(() => {
        currentSimulationYear += 1;
        if (currentSimulationYear > 50) {
            currentSimulationYear = 50;
            clearInterval(animationInterval);
            document.getElementById("btn-play").innerHTML = '<i class="fa-solid fa-play"></i> <span id="play-text">Iniciar Tiempo</span>';
            isPlaying = false;
        }
        scrubTime(currentSimulationYear);
    }, 200 / animationSpeed); // Velocidad ajustable
}

// 9. Reproducción
function togglePlay() {
    const playBtn = document.getElementById("btn-play");
    
    if (isPlaying) {
        clearInterval(animationInterval);
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span id="play-text">Iniciar Tiempo</span>';
        isPlaying = false;
    } else {
        if (currentSimulationYear >= 50) {
            currentSimulationYear = 0;
        }
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="play-text">Pausar Tiempo</span>';
        isPlaying = true;
        startPlayInterval();
    }
}

function resetAnimation() {
    clearInterval(animationInterval);
    currentSimulationYear = 0;
    isPlaying = false;
    document.getElementById("btn-play").innerHTML = '<i class="fa-solid fa-play"></i> <span id="play-text">Iniciar Tiempo</span>';
    scrubTime(0);
}

// 10. Inicialización
window.onload = function() {
    // Activar clase activa inicial en SVG
    const activeEl = document.getElementById(`region-${activeRegion}`);
    if (activeEl) {
        activeEl.classList.add('active-region');
    }
    
    updateSimulation();
};
