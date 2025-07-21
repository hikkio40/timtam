// Objek State Aplikasi Terpusat
const state = {
    cards: [],
    view: 'grid',
    page: 1,
    perPage: 20,
    loading: false,
    hasMore: true,
    pageType: 'home',
    currentCard: null,
    filters: { // State filter terpusat
        searchInput: '',
        sortBy: 'new',
        sortOrder: 'desc',
        type: '',
        attribute: '',
        race: '',
        archetype: '',
        format: ''
    }
};

// Konstanta API
const API_BASE = 'https://db.ygoprodeck.com/api/v7';

// Referensi elemen DOM yang sering digunakan
const dom = {
    sidebar: document.getElementById('sidebar'),
    mainContent: document.getElementById('mainContent'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    searchInput: document.getElementById('searchInput'),
    sortBy: document.getElementById('sortBy'),
    sortOrder: document.getElementById('sortOrder'),
    typeFilter: document.getElementById('typeFilter'),
    attributeFilter: document.getElementById('attributeFilter'),
    raceFilter: document.getElementById('raceFilter'),
    archetypeFilter: document.getElementById('archetypeFilter'),
    formatFilter: document.getElementById('formatFilter'),
    gridViewBtn: document.getElementById('gridViewBtn'),
    listViewBtn: document.getElementById('listViewBtn'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    cardsContainer: document.getElementById('cardsContainer'),
    mainHeader: document.querySelector('header'),
    mainElement: document.querySelector('main')
};

// ID Filter yang merujuk langsung ke dropdown select
const FILTER_IDS = ['typeFilter', 'attributeFilter', 'raceFilter', 'archetypeFilter', 'formatFilter'];

/**
 * Fungsi utilitas untuk mendapatkan elemen berdasarkan ID.
 * @param {string} id - ID elemen.
 * @returns {HTMLElement} Elemen DOM.
 */
const $ = id => document.getElementById(id);

/**
 * Fungsi utilitas untuk mendapatkan semua elemen yang cocok dengan selector.
 * @param {string} selector - Selector CSS.
 * @returns {NodeList} NodeList dari elemen DOM.
 */
const $$ = selector => document.querySelectorAll(selector);

/**
 * Fungsi utilitas untuk membuat elemen DOM baru.
 * @param {string} tag - Nama tag HTML (misal: 'div', 'p').
 * @param {string} [className] - Nama kelas CSS opsional.
 * @param {string} [content] - Konten HTML opsional.
 * @returns {HTMLElement} Elemen DOM yang dibuat.
 */
const createElement = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content) el.innerHTML = content;
    return el;
};

/**
 * Menginisialisasi aplikasi setelah DOM dimuat.
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeFilters();
    setupEventListeners();
    setupInfiniteScroll();
    setupSidebarToggle();
    showHomePage();
});

/**
 * Mengatur semua event listener untuk interaksi pengguna.
 */
function setupEventListeners() {
    dom.gridViewBtn.onclick = () => switchView('grid');
    dom.listViewBtn.onclick = () => switchView('list');
    
    // Event listener untuk input pencarian
    dom.searchInput.addEventListener('input', (e) => {
        state.filters.searchInput = e.target.value;
        performSearch();
    });
    dom.searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Event listener untuk dropdown Sort By dan Sort Order
    dom.sortBy.onchange = (e) => {
        state.filters.sortBy = e.target.value;
        performSearch();
    };
    dom.sortOrder.onchange = (e) => {
        state.filters.sortOrder = e.target.value;
        performSearch();
    };

    // Event listener untuk dropdown filter
    FILTER_IDS.forEach(id => {
        const element = dom[id]; // Menggunakan referensi dari objek dom
        if (element) {
            element.onchange = (e) => {
                state.filters[id.replace('Filter', '')] = e.target.value;
                performSearch();
            };
        }
    });
}

/**
 * Mengatur fungsionalitas toggle sidebar dan responsivitas.
 */
function setupSidebarToggle() {
    let isCollapsed = false; // Melacak status sidebar

    const toggleSidebar = () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            dom.sidebar.classList.add('-translate-x-full');
            dom.mainContent.classList.remove('ml-64');
            dom.mainContent.classList.add('ml-0');
            dom.sidebarToggle.innerHTML = '☰'; // Ikon Hamburger
        } else {
            dom.sidebar.classList.remove('-translate-x-full');
            dom.mainContent.classList.remove('ml-0');
            dom.mainContent.classList.add('ml-64');
            dom.sidebarToggle.innerHTML = '✕'; // Ikon Tutup
        }
    };

    const handleResize = () => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            // Di perangkat seluler, sidebar harus disembunyikan secara default
            if (!dom.sidebar.classList.contains('-translate-x-full')) {
                dom.sidebar.classList.add('-translate-x-full');
                dom.mainContent.classList.remove('ml-64');
                dom.mainContent.classList.add('ml-0');
                dom.sidebarToggle.innerHTML = '☰';
                isCollapsed = true;
            }
        } else {
            // Di desktop, sidebar harus terlihat secara default
            if (dom.sidebar.classList.contains('-translate-x-full')) {
                dom.sidebar.classList.remove('-translate-x-full');
                dom.mainContent.classList.remove('ml-0');
                dom.mainContent.classList.add('ml-64');
                dom.sidebarToggle.innerHTML = '✕';
                isCollapsed = false;
            }
        }
    };

    // Status awal berdasarkan desktop/seluler
    handleResize(); 

    // Menetapkan event listener
    dom.sidebarToggle.onclick = toggleSidebar;
    window.onresize = handleResize;
}

/**
 * Mengatur fungsionalitas scroll tak terbatas untuk memuat lebih banyak kartu.
 */
function setupInfiniteScroll() {
    window.onscroll = () => {
        if (state.loading || !state.hasMore || state.pageType !== 'home') return;
        
        const { scrollTop, scrollHeight } = document.documentElement;
        const { innerHeight } = window;
        
        if (scrollTop + innerHeight >= scrollHeight - 1000) {
            loadMoreCards();
        }
    };
}

/**
 * Menampilkan halaman utama dengan daftar kartu.
 */
function showHomePage() {
    state.pageType = 'home';
    dom.mainHeader.style.display = 'flex'; // Memastikan header adalah flex untuk tombol toggle
    dom.mainElement.innerHTML = '<div id="cardsContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"></div>';
    dom.cardsContainer = document.getElementById('cardsContainer'); // Perbarui referensi setelah innerHTML
    loadCards(); // Memastikan kartu dimuat saat kembali ke beranda
}

/**
 * Menampilkan halaman detail kartu.
 * @param {object} card - Objek data kartu yang akan ditampilkan.
 */
function showCardDetail(card) {
    state.pageType = 'cardDetail';
    state.currentCard = card;
    dom.mainHeader.style.display = 'none';
    renderCardDetailPage();
}

/**
 * Merender halaman detail kartu berdasarkan kartu yang sedang dipilih.
 */
function renderCardDetailPage() {
    dom.mainElement.innerHTML = `
        <div class="w-full">
            <button id="backToHome" class="mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">← Kembali ke Kartu</button>
            <div class="bg-white rounded-lg p-4 md:p-6">
                <div class="flex flex-col lg:flex-row gap-6 md:gap-8">
                    <div class="lg:w-auto flex-shrink-0 space-y-4">
                        <img id="cardDetailImage" src="" alt="" class="w-full max-w-sm mx-auto lg:mx-0 rounded-lg">
                        <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                            <button id="downloadImageBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm">📥 Unduh Gambar</button>
                            <button id="downloadCroppedBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm">📥 Unduh Terpotong</button>
                        </div>
                    </div>
                    <div class="flex-1 space-y-6">
                        <div id="cardDetailDetails" class="space-y-3"></div>
                        <div><h4 class="font-bold text-xl mb-3">Teks Kartu:</h4><p id="cardDetailText" class="text-gray-700 bg-white p-4 rounded-lg"></p></div>
                    </div>
                </div>
                <div id="variantArtworkSection" class="mt-8 md:mt-12"><h4 class="font-bold text-xl md:text-2xl mb-4 md:mb-6">Artwork Varian</h4><div id="variantArtwork" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4"></div></div>
                <div id="relatedCardsSection" class="mt-8 md:mt-12"><h4 class="font-bold text-xl md:text-2xl mb-4 md:mb-6">Kartu Terkait</h4><div id="relatedCards" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4"></div></div>
            </div>
        </div>`;
    
    $('backToHome').onclick = showHomePage;
    populateCardDetail();
}

/**
 * Membuat string HTML untuk satu kartu berdasarkan tipe tampilan.
 * @param {object} card - Objek data kartu.
 * @param {boolean} isGridView - True jika merender untuk tampilan grid, false untuk tampilan daftar.
 * @returns {string} String HTML untuk kartu.
 */
function createCardHTML(card, isGridView) {
    if (isGridView) {
        return `
            <div class="card-item bg-white rounded-lg overflow-hidden card-hover transition-all duration-300 cursor-pointer" data-card-id="${card.id}">
                <img src="${card.card_images[0].image_url_small}" alt="${card.name}" class="w-full object-cover" loading="lazy">
            </div>`;
    } else {
        return `
            <div class="card-item bg-white rounded-lg p-3 md:p-4 flex items-center space-x-3 md:space-x-4 hover:shadow-lg transition-shadow cursor-pointer" data-card-id="${card.id}">
                <img src="${card.card_images[0].image_url_small}" alt="${card.name}" class="w-12 h-18 md:w-16 md:h-24 object-cover rounded flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-base md:text-lg mb-1 truncate">${card.name}</h3>
                    <p class="text-xs md:text-sm text-gray-600 mb-1">${card.type}</p>
                    ${card.attribute ? `<p class="text-xs md:text-sm text-gray-600 mb-1">Attribute: ${card.attribute}</p>` : ''}
                    ${card.atk !== undefined ? `<p class="text-xs md:text-sm text-gray-600">ATK: ${card.atk} / DEF: ${card.def}</p>` : ''}
                    ${card.level ? `<p class="text-xs md:text-sm text-gray-600">Level: ${card.level}</p>` : ''}
                </div>
            </div>`;
    }
}

/**
 * Mengisi detail kartu pada halaman detail.
 */
function populateCardDetail() {
    const card = state.currentCard;
    let currentImage = card.card_images[0];
    
    $('cardDetailImage').src = currentImage.image_url;
    $('cardDetailText').textContent = card.desc;
    
    // Fungsi untuk memperbarui tombol unduh berdasarkan gambar saat ini
    const updateDownloadButtons = (imageData) => {
        $('downloadImageBtn').onclick = () => downloadImage(imageData.image_url, `${card.name}.jpg`);
        $('downloadCroppedBtn').onclick = () => downloadImage(imageData.image_url_cropped, `${card.name}_cropped.jpg`);
    };
    
    // Atur tombol unduh awal
    updateDownloadButtons(currentImage);
    
    // Simpan fungsi pembaruan secara global agar artwork varian dapat menggunakannya
    window.updateDownloadButtons = updateDownloadButtons;
    
    /**
     * Helper untuk membuat kotak detail. Menambahkan parameter filterType untuk kemampuan klik.
     * @param {string} label - Label yang akan ditampilkan.
     * @param {string|number} value - Nilai yang akan ditampilkan.
     * @param {string} [filterType] - Tipe filter yang akan diterapkan saat diklik (misal: 'type', 'attribute').
     * @returns {string} String HTML untuk kotak detail.
     */
    const createDetailBox = (label, value, filterType = null) => { 
        if (!value && value !== 0) return ''; 
        // Tambahkan atribut data untuk filtering dan kelas untuk delegasi event
        const dataAttributes = filterType ? `data-filter-type="${filterType}" data-filter-value="${value}"` : '';
        const clickableClass = filterType ? 'clickable-detail-filter cursor-pointer hover:bg-gray-300' : '';

        return `
            <div class="bg-gray-200 text-gray-800 p-3 rounded-lg flex items-center space-x-2 ${clickableClass}" ${dataAttributes}>
                <div>
                    <div class="text-xs font-semibold opacity-80">${label}</div>
                    <div class="font-bold text-lg">${value}</div>
                </div>
            </div>
        `;
    };

    // Tentukan apakah itu Link Monster untuk "LINK" vs "Level"
    const isLinkMonster = card.type && card.type.includes('Link');
    const levelOrLinkLabel = isLinkMonster ? 'LINK' : 'Level';
    const levelOrLinkValue = isLinkMonster ? (card.linkval !== undefined ? card.linkval : '') : (card.level !== undefined ? card.level : '');

    // Periksa apakah kartu adalah monster (bukan Spell atau Trap) untuk menampilkan Race/Typing
    const isMonsterCard = !card.type.includes('Spell Card') && !card.type.includes('Trap Card');

    // Bangun HTML detail
    const detailsHtml = `
        <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-4">${card.name}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${createDetailBox('Tipe', card.type, 'type')}
            ${card.attribute ? createDetailBox('Atribut', card.attribute, 'attribute') : ''}
            ${isMonsterCard && card.race ? createDetailBox('Tipe (Ras)', card.race, 'race') : ''}
            ${card.atk !== undefined ? createDetailBox('ATK', card.atk) : ''}
            ${isMonsterCard && !isLinkMonster && card.def !== undefined ? createDetailBox('DEF', card.def) : ''}
            ${isLinkMonster && levelOrLinkValue !== '' ? createDetailBox(levelOrLinkLabel, levelOrLinkValue) : ''}
            ${!isLinkMonster && card.level !== undefined ? createDetailBox(levelOrLinkLabel, levelOrLinkValue) : ''}
            ${card.archetype ? createDetailBox('Archetype', card.archetype, 'archetype') : ''}
        </div>
    `;
    
    $('cardDetailDetails').innerHTML = detailsHtml;
    
    // Tambahkan event listener klik untuk elemen filter yang baru dapat diklik
    $$('.clickable-detail-filter').forEach(el => {
        el.onclick = () => {
            const filterType = el.dataset.filterType;
            const filterValue = el.dataset.filterValue;

            if (filterType && filterValue) {
                // Reset semua filter terlebih dahulu, lalu terapkan yang spesifik
                for (const key in state.filters) {
                    state.filters[key] = '';
                }
                state.filters[filterType] = filterValue;
                
                // Perbarui dropdown untuk mencerminkan filter baru
                const filterElement = dom[filterType + 'Filter'] || dom[filterType];
                if (filterElement) {
                    filterElement.value = filterValue;
                }

                showHomePage(); // Ini akan memicu loadCards() dengan filter baru
            }
        };
    });
    
    loadVariantArtwork(card);
    loadRelatedCards(card);
}

/**
 * Menginisialisasi opsi filter dropdown.
 */
async function initializeFilters() {
    const filterData = {
        typeFilter: [
            'Effect Monster', 'Normal Monster', 'Fusion Monster', 'Ritual Monster',
            'Synchro Monster', 'Xyz Monster', 'Pendulum Effect Monster', 'Pendulum Normal Monster',
            'Link Monster', 'Spell Card', 'Trap Card', 'Token', 'Skill Card'
        ],
        attributeFilter: ['DARK', 'LIGHT', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE'],
        raceFilter: ['Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur', 'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie'],
        formatFilter: ['TCG', 'OCG'], // Hanya TCG dan OCG
    };

    // Isi opsi filter statis (Type, Attribute, Race, Format)
    Object.entries(filterData).forEach(([id, options]) => {
        const select = dom[id]; // Menggunakan referensi dari objek dom
        if (!select) return;

        // Hapus opsi yang ada terlebih dahulu (jika ada)
        select.innerHTML = `<option value="">Semua ${id.replace('Filter', '')}s</option>`; // Opsi "Semua" default
        
        options.forEach(option => {
            const opt = createElement('option');
            opt.value = option; 
            opt.textContent = option;
            select.appendChild(opt);
        });
    });

    // Isi filter Archetype secara dinamis
    try {
        const archetypes = await fetch(`${API_BASE}/archetypes.php`).then(r => r.json()).catch(() => []);
        const archetypeSelect = dom.archetypeFilter; // Menggunakan referensi dari objek dom
        if (archetypes.length && archetypeSelect) {
            // Tambahkan opsi "Semua Archetype"
            const allArchetypeOption = createElement('option');
            allArchetypeOption.value = '';
            allArchetypeOption.textContent = 'Semua Archetype';
            archetypeSelect.appendChild(allArchetypeOption);

            archetypes.forEach(arch => {
                const opt = createElement('option');
                opt.value = arch.archetype_name;
                opt.textContent = arch.archetype_name;
                archetypeSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error mengambil archetype:", e);
    }

    // Atur nilai filter awal dari state ke dropdown
    for (const key in state.filters) {
        const element = dom[key + 'Filter'] || dom[key]; // Periksa untuk akhiran Filter atau ID langsung
        if (element && state.filters[key] !== '') {
            element.value = state.filters[key];
        }
    }
}

/**
 * Memuat kartu dari API berdasarkan filter dan pengaturan pagination.
 * @param {boolean} [reset=true] - True untuk mereset daftar kartu dan pagination.
 */
async function loadCards(reset = true) {
    if (reset) {
        state.page = 1;
        state.cards = [];
        state.hasMore = true;
        if (dom.cardsContainer) dom.cardsContainer.innerHTML = '';
    }
    
    state.loading = true;
    showLoading(true);
    
    try {
        const params = new URLSearchParams();
        
        // Tambahkan query pencarian jika ada
        if (state.filters.searchInput) {
            params.append('fname', state.filters.searchInput);
        }
        
        // Tambahkan parameter filter dari state.filters
        // Baca nilai saat ini dari elemen select
        FILTER_IDS.forEach(id => {
            const element = dom[id]; // Menggunakan referensi dari objek dom
            if (element && element.value !== '') {
                let paramName = id.replace('Filter', '');
                if (paramName === 'format') { // API mengharapkan 'format' untuk formatFilter
                    params.append('format', element.value);
                } else {
                    params.append(paramName, element.value);
                }
            }
        });

        // Tambahkan parameter urutkan
        const sortByValue = dom.sortBy.value;
        const sortOrderValue = dom.sortOrder.value;

        if (sortByValue && sortByValue !== 'new') {
            params.append('sort', sortByValue);
            params.append('sortorder', sortOrderValue);
        } else if (sortByValue === 'new') {
            params.append('sort', 'new');
        }

        // Tambahkan parameter pagination
        params.append('num', state.perPage);
        params.append('offset', (state.page - 1) * state.perPage);
        
        const response = await fetch(`${API_BASE}/cardinfo.php?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kesalahan HTTP! status: ${response.status}, pesan: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.data?.length) {
            state.cards = reset ? data.data : [...state.cards, ...data.data];
            state.hasMore = data.data.length === state.perPage;
            displayCards(reset);
        } else {
            if (reset) state.cards = [];
            state.hasMore = false;
            displayCards(reset);
        }
    } catch (error) {
        console.error('Error memuat kartu:', error);
        if (dom.cardsContainer) {
            dom.cardsContainer.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">
                Error memuat kartu: ${error.message || 'Silakan coba lagi nanti.'}
            </div>`;
        }
        state.cards = [];
        state.hasMore = false;
    } finally {
        state.loading = false;
        showLoading(false);
    }
}

/**
 * Memuat lebih banyak kartu saat scroll tak terbatas.
 */
async function loadMoreCards() {
    if (state.loading || !state.hasMore) return;
    state.page++;
    await loadCards(false); 
}

/**
 * Menampilkan kartu di wadah kartu.
 * @param {boolean} [reset=true] - True untuk mereset konten wadah.
 */
function displayCards(reset = true) {
    if (!dom.cardsContainer) return;
    
    if (!state.cards.length && reset) {
        dom.cardsContainer.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Tidak ada kartu ditemukan. Coba sesuaikan pencarian atau filter Anda.</div>';
        return;
    }
    
    const isGrid = state.view === 'grid';
    dom.cardsContainer.className = isGrid ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6' : 'space-y-4';
    
    if (reset) {
        dom.cardsContainer.innerHTML = state.cards.map(card => createCardHTML(card, isGrid)).join('');
    } else {
        dom.cardsContainer.insertAdjacentHTML('beforeend', state.cards.slice(-state.perPage).map(card => createCardHTML(card, isGrid)).join(''));
    }
    
    const cardElements = dom.cardsContainer.querySelectorAll('.card-item');
    cardElements.forEach(el => {
        el.onclick = () => {
            const card = state.cards.find(c => c.id == el.dataset.cardId);
            if (card) {
                showCardDetail(card);
            } else {
                console.error(`Kartu dengan ID ${el.dataset.cardId} tidak ditemukan di state.cards`);
            }
        };
    });
}

/**
 * Mengubah tampilan kartu antara grid dan daftar.
 * @param {string} view - 'grid' atau 'list'.
 */
function switchView(view) {
    state.view = view;
    const isGrid = view === 'grid';
    dom.gridViewBtn.className = `px-4 py-2 ${isGrid ? 'bg-gray-200 text-gray-800' : 'bg-gray-200 text-gray-800'} rounded hover:${isGrid ? 'bg-gray-300' : 'bg-gray-300'} transition-colors`;
    dom.listViewBtn.className = `px-4 py-2 ${!isGrid ? 'bg-gray-200 text-gray-800' : 'bg-gray-200 text-gray-800'} rounded hover:${!isGrid ? 'bg-gray-300' : 'bg-gray-300'} transition-colors`;
    displayCards();
}

/**
 * Melakukan pencarian atau pembaruan filter.
 */
function performSearch() {
    loadCards(true); 
}

/**
 * Memuat dan menampilkan artwork varian untuk kartu yang sedang dilihat.
 * @param {object} card - Objek data kartu.
 */
function loadVariantArtwork(card) {
    const variantContainer = $('variantArtwork');
    const variantSection = $('variantArtworkSection');
    
    if (!variantContainer || !card.card_images || card.card_images.length <= 1) {
        variantSection.style.display = 'none';
        return;
    }
    
    variantSection.style.display = 'block';
    variantContainer.innerHTML = card.card_images.map((image, i) => 
        `<div class="variant-artwork cursor-pointer hover:opacity-75 transition-opacity" data-image-index="${i}">
            <div class="aspect-[3/4] overflow-hidden rounded">
                <img src="${image.image_url_small}" alt="${card.name} Varian ${i + 1}" class="w-full h-full object-contain">
            </div>
        </div>`
    ).join('');
    
    $$('.variant-artwork').forEach(el => {
        el.onclick = () => {
            const imageIndex = parseInt(el.getAttribute('data-image-index'));
            const selectedImage = card.card_images[imageIndex];
            
            $('cardDetailImage').src = selectedImage.image_url;
            
            if (window.updateDownloadButtons) {
                window.updateDownloadButtons(selectedImage);
            }
        };
    });
}

/**
 * Memuat dan menampilkan kartu terkait berdasarkan archetype.
 * @param {object} card - Objek data kartu.
 */
async function loadRelatedCards(card) {
    const container = $('relatedCards');
    if (!container) {
        console.error('Wadah kartu terkait tidak ditemukan!');
        return;
    }
    
    container.innerHTML = '<div class="col-span-full text-center py-4">Memuat kartu terkait...</div>';
    
    try {
        let related = [];
        const maxRelated = 12;

        if (card.archetype) {
            const response = await fetch(`${API_BASE}/cardinfo.php?archetype=${encodeURIComponent(card.archetype)}&num=${maxRelated}&offset=0`);
            const data = await response.json();
            
            if (data.data && Array.isArray(data.data)) {
                const archetypeCards = data.data.filter(c => 
                    c.id !== card.id && 
                    c.card_images && 
                    c.card_images.length > 0
                );
                related.push(...archetypeCards);
            }
        }
        
        const uniqueRelated = related.filter((card, index, self) => 
            index === self.findIndex(c => c.id === card.id)
        ).slice(0, maxRelated);
        
        if (uniqueRelated.length > 0) {
            window.relatedCardsData = uniqueRelated;
            const html = uniqueRelated.map(card => createCardHTML(card, true)).join('');
            container.innerHTML = html;
            
            const cardElements = container.querySelectorAll('.card-item'); 
            cardElements.forEach((el) => { 
                el.addEventListener('click', () => {
                    const cardId = el.dataset.cardId; 
                    const card = window.relatedCardsData.find(c => c.id == cardId); 
                    if (card) {
                        showCardDetail(card);
                    }
                });
            });
        } else {
            container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Tidak ada kartu terkait ditemukan.</div>';
        }
    } catch (error) {
        console.error('Kesalahan kritis dalam loadRelatedCards:', error);
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Error memuat kartu terkait.</div>';
    }
}

/**
 * Menampilkan atau menyembunyikan indikator loading.
 * @param {boolean} show - True untuk menampilkan, false untuk menyembunyikan.
 */
const showLoading = show => dom.loadingIndicator.classList.toggle('hidden', !show);

/**
 * Mengunduh gambar atau membukanya di tab baru jika unduhan langsung diblokir.
 * @param {string} imageUrl - URL gambar yang akan diunduh.
 * @param {string} filename - Nama file untuk gambar yang diunduh.
 */
async function downloadImage(imageUrl, filename) {
    try {
        // Mencoba fetch dengan mode 'no-cors'. Ini akan menghasilkan respons 'opaque'
        // yang tidak dapat diakses untuk blob() jika server tidak mengizinkan CORS.
        const response = await fetch(imageUrl, { mode: 'no-cors' }); 
        
        // Mencoba membuat Blob. Ini akan gagal jika respons 'opaque'
        // dan akan memicu blok catch.
        const blob = await response.blob(); 
        const url = URL.createObjectURL(blob);
        const a = createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Gagal mengunduh langsung, beralih ke membuka di tab baru:", error);
        // Fallback: membuka di tab baru jika unduhan langsung gagal (misal: karena kebijakan CORS)
        const a = createElement('a');
        Object.assign(a, {
            href: imageUrl,
            download: filename, // Atribut 'download' ini mungkin tidak berfungsi saat membuka di tab baru untuk sumber daya lintas-asal
            target: '_blank',
            rel: 'noopener noreferrer'
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}