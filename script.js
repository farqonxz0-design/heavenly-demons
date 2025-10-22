// ==========================================================
// script.js (v7.0 - Worker-Based Ping)
// Heavenly Demons Configurator
// ==========================================================

document.addEventListener('DOMContentLoaded', function() {
    // --- PENGATURAN ---
    const PROXY_LIST_URL = 'https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt';
    const DEFAULT_PING_TESTER_URL = 'https://ping-tester-worker.zallstore.workers.dev'; // URL Worker Ping Default

    // --- Referensi Elemen DOM ---
    const serverListContainer = document.getElementById('server-list');
    const searchInput = document.getElementById('search-input');
    const pingWorkerUrlInput = document.getElementById('ping-worker-url');
    const selectedCountBtn = document.getElementById('selected-count-btn');
    const repingBtn = document.getElementById('reping-btn');
    const ispInfo = document.getElementById('isp-info');
    const locationInfo = document.getElementById('location-info');
    const settingsBtn = document.getElementById('settings-btn');
    const exportBtn = document.getElementById('export-btn');
    const modalOverlay = document.getElementById('settings-modal-overlay');
    const settingsDoneBtn = document.getElementById('settings-done-btn');

    // Elemen Dropdown Kustom
    const customDropdown = document.querySelector('.custom-dropdown');
    const selectedCountryEl = document.getElementById('selected-country');
    const countryOptionsContainer = document.getElementById('country-options');

    const bugCdnInput = document.getElementById('bug-cdn-input');
    const workerHostInput = document.getElementById('worker-host-input');
    const uuidInput = document.getElementById('uuid-input');
    const protocolSelect = document.getElementById('protocol-select');
    const tlsSelect = document.getElementById('tls-select');
    
    // --- State Aplikasi ---
    let allServers = [];
    let selectedServers = new Set();
    let isShowingOnlySelected = false;
    let activePingTesterUrl = DEFAULT_PING_TESTER_URL;

    // =======================================================
    // FUNGSI INTI & PEMBANTU
    // =======================================================

    function setupPingWorkerUrl() {
        // Selalu gunakan URL default sebagai dasar, tetapi biarkan input bisa kosong
        activePingTesterUrl = DEFAULT_PING_TESTER_URL;
        const savedUrl = localStorage.getItem('pingTesterUrl');

        if (savedUrl) {
            pingWorkerUrlInput.value = savedUrl;
            activePingTesterUrl = savedUrl;
        }
        // Jangan set nilai default ke input field, biarkan placeholder yang bekerja

        pingWorkerUrlInput.addEventListener('change', () => {
            const newUrl = pingWorkerUrlInput.value.trim();
            if (newUrl) {
                activePingTesterUrl = newUrl;
                localStorage.setItem('pingTesterUrl', newUrl);
                showToast('URL Worker Ping diperbarui.');
                pingAllVisibleServers();
            } else {
                activePingTesterUrl = DEFAULT_PING_TESTER_URL;
                localStorage.removeItem('pingTesterUrl');
                pingWorkerUrlInput.value = DEFAULT_PING_TESTER_URL;
                showToast('URL Worker Ping dikembalikan ke default.');
            }
        });
    }

    function generateUUIDv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = 'toast-notification';
        if (isError) toast.classList.add('error');
        
        document.body.appendChild(toast);
        
        setTimeout(() => { toast.classList.add('visible'); }, 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => { document.body.removeChild(toast); }, 300);
        }, 2700);
    }

    async function initializeApp() {
        setupPingWorkerUrl();
        detectUserInfo();
        populateSettingsFromUrl();
        try {
            serverListContainer.innerHTML = '<p>Mengunduh daftar server...</p>';
            const response = await fetch(PROXY_LIST_URL);
            if (!response.ok) throw new Error(`Gagal mengunduh daftar: ${response.statusText}`);
            
            const textData = await response.text();
            allServers = parseProxyList(textData);
            populateCountryFilter(allServers);
            renderServers(allServers);
        } catch (error) {
            console.error("Initialization Error:", error);
            serverListContainer.innerHTML = `<p style="color: var(--danger-color);">Gagal memuat data server. <br><small>${error.message}</small></p>`;
        }
    }

    function parseProxyList(text) {
        return text.trim().split('\n').map(line => {
            const parts = line.split(',');
            if (parts.length < 4) return null;
            return {
                id: `${parts[0].trim()}:${parts[1].trim()}`,
                ip: parts[0].trim(),
                port: parts[1].trim(),
                country_code: parts[2].trim(),
                provider: parts[3].trim()
            };
        }).filter(Boolean);
    }

    function populateCountryFilter(servers) {
        countryOptionsContainer.innerHTML = ''; // Bersihkan opsi lama

        // Tambahkan opsi "Pilih Negara" sebagai default
        const allOption = document.createElement('div');
        allOption.className = 'option selected';
        allOption.dataset.value = 'all';
        allOption.textContent = 'Pilih Negara';
        allOption.addEventListener('click', () => selectCountry('all', 'Pilih Negara'));
        countryOptionsContainer.appendChild(allOption);

        const countries = [...new Set(servers.map(s => s.country_code))].sort();
        countries.forEach(code => {
            const option = document.createElement('div');
            option.className = 'option';
            option.dataset.value = code;
            option.textContent = code;
            option.addEventListener('click', () => selectCountry(code, code));
            countryOptionsContainer.appendChild(option);
        });
    }

    function selectCountry(value, text) {
        selectedCountryEl.textContent = text;
        customDropdown.dataset.value = value;
        customDropdown.classList.remove('active');

        // Hapus kelas 'selected' dari semua opsi
        countryOptionsContainer.querySelectorAll('.option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Tambahkan kelas 'selected' ke opsi yang diklik
        const selectedOption = countryOptionsContainer.querySelector(`.option[data-value="${value}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }

        applyAllFilters();
    }

    function renderServers(serversToRender) {
        serverListContainer.innerHTML = '';
        if (serversToRender.length === 0) {
            serverListContainer.innerHTML = '<p>Tidak ada server yang ditemukan.</p>';
            return;
        }

        const groupedByProvider = serversToRender.reduce((acc, server) => {
            (acc[server.provider] = acc[server.provider] || []).push(server);
            return acc;
        }, {});

        for (const provider in groupedByProvider) {
            const groupTitle = document.createElement('h3');
            groupTitle.className = 'server-group-title';
            groupTitle.textContent = provider;
            serverListContainer.appendChild(groupTitle);
            
            groupedByProvider[provider].forEach(server => {
                const card = document.createElement('div');
                card.className = 'server-card';
                card.dataset.serverId = server.id;
                if (selectedServers.has(server.id)) {
                    card.classList.add('selected');
                }

                card.innerHTML = `
                    <div class="server-details">
                        <p class="provider">
                            <span class="country-code">${server.country_code}</span>
                            ${server.provider}
                        </p>
                        <p class="address">${server.ip}:${server.port}</p>
                    </div>
                    <span class="ping-badge">...</span>
                `;
                card.addEventListener('click', () => toggleServerSelection(card, server.id));
                serverListContainer.appendChild(card);
            });
        }
        pingAllVisibleServers();
    }

    async function detectUserInfo() {
        try {
            const response = await fetch('https://ipinfo.io/json');
            if (!response.ok) throw new Error('Response not OK');
            const data = await response.json();
            ispInfo.textContent = data.org || 'N/A';
            locationInfo.textContent = `${data.city || ''}, ${data.country || ''}`;
        } catch (error) {
            console.warn("Gagal mendeteksi info pengguna:", error);
            ispInfo.textContent = 'N/A';
            locationInfo.textContent = 'N/A';
        }
    }

    function populateSettingsFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const hostFromUrl = urlParams.get('host');

        if (hostFromUrl) {
            workerHostInput.value = hostFromUrl;
        }
        
        if (!uuidInput.value) {
            uuidInput.value = generateUUIDv4();
        }
    }

    // =======================================================
    // FUNGSI PING (VERSI 4.0 - WORKER-BASED PING)
    // =======================================================
    
    async function pingServer(ip, port, timeout = 8000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(activePingTesterUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ip, port }),
            });

            clearTimeout(id);

            if (!response.ok) {
                console.error(`Ping worker returned an error for ${ip}:${port}: ${response.statusText}`);
                return -1;
            }

            const data = await response.json();
            return data.ping;

        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                console.warn(`Ping request for ${ip}:${port} timed out.`);
            } else {
                console.error(`Error pinging ${ip}:${port} via worker:`, error);
            }
            return -1;
        }
    }

    async function pingAllVisibleServers() {
        const serverCards = serverListContainer.querySelectorAll('.server-card');
        
        const pingPromises = Array.from(serverCards).map(async (card) => {
            const serverId = card.dataset.serverId;
            if (!serverId) return;
            const [ip, port] = serverId.split(':');
            const pingBadge = card.querySelector('.ping-badge');
            
            if (pingBadge) {
                pingBadge.textContent = '...';
                pingBadge.style.backgroundColor = '';

                const pingValue = await pingServer(ip, port);
                
                requestAnimationFrame(() => {
                    if (pingValue === -1) {
                        pingBadge.textContent = 'N/A';
                        pingBadge.style.backgroundColor = '#555';
                    } else {
                        pingBadge.textContent = `${pingValue} ms`;
                        if (pingValue < 250) pingBadge.style.backgroundColor = 'var(--cyber-cyan)';
                        else if (pingValue < 1000) pingBadge.style.backgroundColor = '#fdd835';
                        else pingBadge.style.backgroundColor = 'var(--primary-demonic)';
                    }
                });
            }
        });

        await Promise.all(pingPromises);
    }

    // =======================================================
    // FUNGSI INTERAKTIVITAS & MODAL
    // =======================================================
    
    function toggleServerSelection(cardElement, serverId) {
        if (selectedServers.has(serverId)) {
            selectedServers.delete(serverId);
            cardElement.classList.remove('selected');
        } else {
            selectedServers.add(serverId);
            cardElement.classList.add('selected');
        }
        updateSelectedCount();

        if (isShowingOnlySelected && selectedServers.size === 0) {
            isShowingOnlySelected = false;
            applyAllFilters();
        }
    }

    function updateSelectedCount() {
        selectedCountBtn.textContent = `${selectedServers.size} proxies`;
    }

    function applyAllFilters() {
        const query = searchInput.value.toLowerCase();
        const selectedCountry = customDropdown.dataset.value || 'all';
        
        let serversToDisplay = allServers;
        if (isShowingOnlySelected) {
            serversToDisplay = allServers.filter(s => selectedServers.has(s.id));
        }
        if (selectedCountry !== 'all') {
            serversToDisplay = serversToDisplay.filter(s => s.country_code === selectedCountry);
        }
        if (query) {
            serversToDisplay = serversToDisplay.filter(s => 
                s.provider.toLowerCase().includes(query) ||
                s.country_code.toLowerCase().includes(query) ||
                s.ip.includes(query)
            );
        }
        renderServers(serversToDisplay);
    }

    function exportProxies() {
        if (selectedServers.size === 0) {
            showToast("Pilih setidaknya satu server!", true);
            return;
        }

        const bugCdn = bugCdnInput.value.trim();
        const workerHost = workerHostInput.value.trim();
        const uuid = uuidInput.value.trim();
        if (!bugCdn || !workerHost || !uuid) {
            showToast("Harap isi semua kolom di Settings.", true);
            openSettingsModal();
            return;
        }
        
        let outputUris = [];
        selectedServers.forEach(serverId => {
            const server = allServers.find(s => s.id === serverId);
            if (server) {
                const path = `/${server.ip}-${server.port}`;
                const name = `${server.country_code} ${server.provider} [${server.ip}]`;
                const useTls = tlsSelect.value === 'true';
                
                // --- PERBAIKAN LOGIKA ---
                // Alamat (Address) harus workerHost.
                // Host header (host) harus bugCdn.
                // SNI (sni) harus sama dengan alamat, yaitu workerHost.
                const uri = `${protocolSelect.value}://${uuid}@${workerHost}:${useTls ? 443 : 80}` +
                            `?encryption=none&type=ws` +
                            `&host=${bugCdn}` + // Menggunakan bugCdn sebagai Host header
                            `&security=${useTls ? 'tls' : 'none'}` +
                            `&sni=${workerHost}` + // SNI harus sama dengan alamat (workerHost)
                            `&path=${encodeURIComponent(path)}` +
                            `#${encodeURIComponent(name)}`;
                outputUris.push(uri);
            }
        });

        const resultString = outputUris.join('\n');
        navigator.clipboard.writeText(resultString).then(() => {
            showToast("Konfigurasi berhasil disalin!");
        }).catch(err => {
            console.error('Gagal menyalin: ', err);
            showToast("Gagal menyalin ke clipboard.", true);
        });
    }

    function openSettingsModal() { modalOverlay.classList.add('visible'); }
    function closeSettingsModal() { modalOverlay.classList.remove('visible'); }

    // =======================================================
    // EVENT LISTENERS
    // =======================================================
    
    searchInput.addEventListener('input', applyAllFilters);

    selectedCountBtn.addEventListener('click', () => {
        if (selectedServers.size === 0) return;
        isShowingOnlySelected = !isShowingOnlySelected;
        applyAllFilters();
        if (isShowingOnlySelected) {
            selectedCountBtn.style.backgroundColor = 'var(--primary-green)';
            selectedCountBtn.style.color = 'var(--text-dark)';
        } else {
            selectedCountBtn.style.backgroundColor = '';
            selectedCountBtn.style.color = '';
        }
    });

    settingsBtn.addEventListener('click', openSettingsModal);
    settingsDoneBtn.addEventListener('click', closeSettingsModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) closeSettingsModal();
    });
    
    exportBtn.addEventListener('click', exportProxies);
    repingBtn.addEventListener('click', () => {
        showToast("Memulai ulang tes ping...");
        pingAllVisibleServers();
    });

    // Event listener untuk dropdown kustom
    customDropdown.querySelector('.dropdown-selected').addEventListener('click', () => {
        customDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (event) => {
        if (!customDropdown.contains(event.target)) {
            customDropdown.classList.remove('active');
        }
    });

    // Jalankan aplikasi
    initializeApp();
});
