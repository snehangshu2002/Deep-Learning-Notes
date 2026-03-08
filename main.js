/* ═══════════════════════════════════════════════
   Deep Learning Notes — Main Application Logic
   ═══════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

// ── NOTES CONFIGURATION ──
// Add new notes here. Each entry creates a sidebar link.
// Categories are grouped automatically. Order within a category
// follows array order.
let NOTES = [
    {
        id: 'rnn-notes',
        title: 'Recurrent Neural Networks',
        file: 'RNN_Notes.html',
        category: 'RNN',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
        description: 'Architecture, forward prop, BPTT, vanishing gradients, and variants',
        tags: ['rnn', 'architecture', 'bptt', 'vanishing gradient'],
    },
    {
        id: 'rnn-forward-prop',
        title: 'RNN Forward Propagation (Interactive)',
        file: 'RNN_Forward_Prop_Interactive.html',
        category: 'RNN',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
        description: 'Interactive step-by-step calculator — see every number flow through the network',
        tags: ['rnn', 'forward propagation', 'interactive', 'calculator'],
    },
    {
        id: 'rnn-diagram',
        title: 'RNN Step-by-Step Diagram',
        file: 'rnn_diagram.html',
        category: 'RNN',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
        description: 'Visual walkthrough of processing "the food is good" with one-hot encoding',
        tags: ['rnn', 'diagram', 'one-hot', 'sentiment'],
    },
];

// Category metadata for styling (Orange theme)
const CATEGORY_META = {
    'Basics': { color: '#fdba74', cssClass: 'cat-basics' },
    'RNN': { color: '#fb923c', cssClass: 'cat-rnn' },
    'LSTM': { color: '#f97316', cssClass: 'cat-lstm' },
    'Transformers': { color: '#ea580c', cssClass: 'cat-transformers' },
    'CNN': { color: '#c2410c', cssClass: 'cat-cnn' },
    'Optimization': { color: '#9a3412', cssClass: 'cat-optimization' },
    'Advanced': { color: '#7c2d12', cssClass: 'cat-advanced' },
};

// ── DOM REFERENCES ──
const navTree = document.getElementById('nav-tree');
const searchInput = document.getElementById('search-input');
const noteFrame = document.getElementById('note-frame');
const tocList = document.getElementById('toc-list');
const tocPanel = document.getElementById('toc-panel');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const overlay = document.getElementById('sidebar-overlay');
const collapseBtn = document.getElementById('sidebar-collapse-btn');
const tocToggleBtn = document.getElementById('toc-toggle-btn');
const appLayout = document.querySelector('.app-layout');

// ── STATE ──
let activeNoteId = null;
let currentSearchQuery = ''; // Tracks last search query for highlighting

// ═══════════════════════════════════════
// SIDEBAR RENDERING
// ═══════════════════════════════════════
function groupByCategory(notes) {
    const groups = {};
    for (const note of notes) {
        if (!groups[note.category]) groups[note.category] = [];
        groups[note.category].push(note);
    }
    return groups;
}

function renderNavTree(notes) {
    const groups = groupByCategory(notes);
    navTree.innerHTML = '';

    if (notes.length === 0) {
        navTree.innerHTML = `
      <div class="no-results">
        <span class="no-results-icon">🔍</span>
        No notes match your search
      </div>`;
        return;
    }

    for (const [category, items] of Object.entries(groups)) {
        const meta = CATEGORY_META[category] || { color: '#64748b', cssClass: 'cat-default' };

        const section = document.createElement('div');
        section.className = `nav-category ${meta.cssClass}`;

        const title = document.createElement('div');
        title.className = 'nav-category-title';
        title.textContent = category;
        section.appendChild(title);

        for (const note of items) {
            const item = document.createElement('a');
            item.className = `nav-item${note.id === activeNoteId ? ' active' : ''}`;
            item.dataset.noteId = note.id;
            item.title = note.description;
            item.innerHTML = `
        <span class="nav-item-icon">${note.icon}</span>
        <span class="nav-item-label">${note.title}</span>`;
            item.dataset.tooltip = note.title;
            item.addEventListener('click', () => loadNote(note.id));
            section.appendChild(item);
        }

        navTree.appendChild(section);
    }
}

// ═══════════════════════════════════════
// NOTE LOADING
// ═══════════════════════════════════════
function loadNote(noteId) {
    const note = NOTES.find(n => n.id === noteId);
    if (!note) return;

    activeNoteId = noteId;

    // ── Update URL hash & active nav state ──
    window.location.hash = `note=${noteId}`;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.noteId === noteId);
    });
    closeSidebar();

    if (note.isExternalUrl) {

        if (note.fileType === 'image') {
            // ── IMAGE: render centered inside the iframe ──
            noteFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            noteFrame.removeAttribute('srcdoc');
            noteFrame.src = 'about:blank';
            noteFrame.onload = () => {
                const doc = noteFrame.contentDocument || noteFrame.contentWindow.document;
                doc.open();
                doc.write(`<!DOCTYPE html><html><head><style>
                    body{margin:0;background:#0f1115;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;box-sizing:border-box;}
                    img{max-width:100%;max-height:100vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);}
                </style></head><body><img src="${note.file}" alt="${note.title}"></body></html>`);
                doc.close();
                tocList.innerHTML = '<div class="toc-empty">No headings (Image file)</div>';
                resetZoom();
            };

        } else if (note.fileType === 'html') {
            // ── HTML: fetch raw text & inject via srcdoc (bypasses MIME type issue) ──
            noteFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
            tocList.innerHTML = '<div class="toc-empty">Loading...</div>';
            fetch(note.file)
                .then(r => r.text())
                .then(html => {
                    noteFrame.removeAttribute('src');
                    noteFrame.srcdoc = html;
                    noteFrame.onload = () => {
                        extractTableOfContents();
                        resetZoom();
                        if (currentSearchQuery) highlightSearchTermInIframe(currentSearchQuery);
                        try {
                            const iframeDoc = noteFrame.contentDocument || noteFrame.contentWindow.document;
                            iframeDoc.addEventListener('mousemove', resetIdleTimer);
                            iframeDoc.addEventListener('touchstart', resetIdleTimer);
                            iframeDoc.addEventListener('keydown', (e) => {
                                resetIdleTimer();
                                if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                                    e.preventDefault();
                                    searchInput.focus();
                                }
                            });
                            resetIdleTimer();
                        } catch (e) { }
                    };
                })
                .catch(() => {
                    // Fallback: open directly
                    noteFrame.srcdoc = '';
                    noteFrame.src = note.file;
                });
            return; // onload is set inside the fetch, so return early

        } else {
            // ── PDF: load directly (jsDelivr CDN serves correct MIME type) ──
            noteFrame.removeAttribute('sandbox');
            noteFrame.removeAttribute('srcdoc');
            noteFrame.src = note.file;
            tocList.innerHTML = '<div class="toc-empty">No headings (PDF file)</div>';
        }

    } else {
        // ── LOCAL file (.html in /notes): restore full sandbox ──
        noteFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
        noteFrame.removeAttribute('srcdoc');
        noteFrame.src = `./notes/${note.file}`;
    }

    // Extract ToC once the iframe loads, reset zoom, and apply any active search highlight
    noteFrame.onload = () => {
        extractTableOfContents();
        resetZoom();
        if (currentSearchQuery) highlightSearchTermInIframe(currentSearchQuery);

        // Bind idle listeners to the iframe document
        try {
            const iframeDoc = noteFrame.contentDocument || noteFrame.contentWindow.document;
            iframeDoc.addEventListener('mousemove', resetIdleTimer);
            iframeDoc.addEventListener('touchstart', resetIdleTimer);
            iframeDoc.addEventListener('keydown', (e) => {
                resetIdleTimer();
                if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInput.focus();
                }
            });
            resetIdleTimer();
        } catch (e) { }
    };
}

// ═══════════════════════════════════════
// I-FRAME ZOOM CONTROLS
// ═══════════════════════════════════════
let currentZoom = 1;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomLevelText = document.getElementById('zoom-level-text');

function applyZoom(scale) {
    if (scale === 1) {
        noteFrame.style.transform = '';
        noteFrame.style.width = '100%';
        noteFrame.style.height = '100%';
        noteFrame.style.minWidth = '';
        noteFrame.style.minHeight = '';
        noteFrame.style.flex = ''; // Restore flex
        noteFrame.style.transformOrigin = '';
    } else {
        const compensation = `${100 / scale}%`;
        noteFrame.style.transformOrigin = 'top left';
        noteFrame.style.transform = `scale(${scale})`;
        noteFrame.style.width = compensation;
        noteFrame.style.height = compensation;
        noteFrame.style.minWidth = compensation;
        noteFrame.style.minHeight = compensation;
        noteFrame.style.flex = 'none'; // Prevent flex container from shrinking the iframe
    }
    zoomLevelText.textContent = `${Math.round(scale * 100)}%`;
}

function zoomIn() {
    if (currentZoom < MAX_ZOOM) {
        currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
        applyZoom(currentZoom);
    }
}

function zoomOut() {
    if (currentZoom > MIN_ZOOM) {
        currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
        applyZoom(currentZoom);
    }
}

function resetZoom() {
    currentZoom = 1;
    applyZoom(currentZoom);
}

if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

function loadNoteFromHash() {
    const hash = window.location.hash.slice(1);
    const match = hash.match(/note=([^&]+)/);
    if (match) {
        const noteId = match[1];
        if (NOTES.find(n => n.id === noteId)) {
            loadNote(noteId);
            return;
        }
    }
    // Default: show welcome
    activeNoteId = null;
    noteFrame.src = './notes/welcome.html';
    noteFrame.onload = () => {
        tocList.innerHTML = '<div class="toc-empty">Select a note to see its outline</div>';

        // Inject dynamic stats into welcome screen
        try {
            const iframeDoc = noteFrame.contentDocument || noteFrame.contentWindow.document;
            iframeDoc.addEventListener('mousemove', resetIdleTimer);
            iframeDoc.addEventListener('touchstart', resetIdleTimer);
            iframeDoc.addEventListener('keydown', (e) => {
                resetIdleTimer();
                if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInput.focus();
                }
            });
            const notesEl = iframeDoc.getElementById('stat-notes');
            const catsEl = iframeDoc.getElementById('stat-categories');

            if (notesEl && catsEl) {
                notesEl.textContent = NOTES.length;
                const uniqueCategories = new Set(NOTES.map(n => n.category)).size;
                catsEl.textContent = uniqueCategories;
            }
        } catch (e) {
            console.error('Could not inject stats into welcome screen:', e);
        }
    };
}

// ═══════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════
function extractTableOfContents() {
    tocList.innerHTML = '';

    try {
        const doc = noteFrame.contentDocument || noteFrame.contentWindow.document;
        const headings = doc.querySelectorAll('h1, h2, h3');

        if (headings.length === 0) {
            tocList.innerHTML = '<div class="toc-empty">No headings found</div>';
            return;
        }

        headings.forEach((heading, i) => {
            // Ensure heading has an id
            if (!heading.id) {
                heading.id = `toc-heading-${i}`;
            }

            const item = document.createElement('a');
            item.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
            item.textContent = heading.textContent.trim();
            item.addEventListener('click', () => {
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            tocList.appendChild(item);
        });
    } catch (e) {
        tocList.innerHTML = '<div class="toc-empty">Table of contents unavailable</div>';
    }
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════

/**
 * Walks all text nodes inside the iframe and wraps matches in <mark> elements.
 * Skips nodes inside <script>, <style>, and <mark> tags to avoid double-wrapping.
 */
function highlightSearchTermInIframe(query) {
    try {
        const iframeDoc = noteFrame.contentDocument || noteFrame.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) return;

        // Remove any previous highlights first
        iframeDoc.querySelectorAll('mark.search-highlight').forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(iframeDoc.createTextNode(mark.textContent), mark);
            parent.normalize();
        });

        if (!query || query.trim().length < 2) return;

        const q = query.trim();
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const skipTags = new Set(['SCRIPT', 'STYLE', 'MARK', 'TEXTAREA', 'INPUT']);

        function walkAndHighlight(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.nodeValue;
                if (!regex.test(text)) { regex.lastIndex = 0; return; }
                regex.lastIndex = 0;

                const fragment = iframeDoc.createDocumentFragment();
                let lastIndex = 0;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match.index > lastIndex) {
                        fragment.appendChild(iframeDoc.createTextNode(text.slice(lastIndex, match.index)));
                    }
                    const mark = iframeDoc.createElement('mark');
                    mark.className = 'search-highlight';
                    mark.textContent = match[0];
                    fragment.appendChild(mark);
                    lastIndex = match.index + match[0].length;
                }
                if (lastIndex < text.length) {
                    fragment.appendChild(iframeDoc.createTextNode(text.slice(lastIndex)));
                }
                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && !skipTags.has(node.tagName)) {
                Array.from(node.childNodes).forEach(walkAndHighlight);
            }
        }

        walkAndHighlight(iframeDoc.body);

        // Inject highlight styles if not already present
        if (!iframeDoc.getElementById('search-highlight-style')) {
            const style = iframeDoc.createElement('style');
            style.id = 'search-highlight-style';
            style.textContent = `
                mark.search-highlight {
                    background: rgba(255, 107, 0, 0.35);
                    color: inherit;
                    border-radius: 3px;
                    padding: 0 2px;
                    box-shadow: 0 0 0 1px rgba(255, 107, 0, 0.5);
                    font-style: inherit;
                    font-weight: inherit;
                }
            `;
            iframeDoc.head.appendChild(style);
        }

        // Scroll to the first match
        const firstMark = iframeDoc.querySelector('mark.search-highlight');
        if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (e) {
        console.warn('Could not highlight in iframe:', e.message);
    }
}

function performSearch(query) {
    const q = query.toLowerCase().trim();
    currentSearchQuery = q;

    if (!q) {
        renderNavTree(NOTES);
        // Remove any existing highlights if search is cleared
        highlightSearchTermInIframe('');
        return;
    }

    const filtered = NOTES.filter(note => {
        const searchable = [
            note.title,
            note.description,
            note.category,
            ...(note.tags || []),
            note.textContent || '' // Include the full text content in the searchable string
        ].join(' ').toLowerCase();
        return searchable.includes(q);
    });

    renderNavTree(filtered);
}

searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
});

// Keyboard shortcut: "/" to focus search
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.blur();
        searchInput.value = '';
        performSearch('');
    }
});

// ═══════════════════════════════════════
// MOBILE SIDEBAR
// ═══════════════════════════════════════
function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

overlay.addEventListener('click', closeSidebar);

// ═══════════════════════════════════════
// SIDEBAR COLLAPSE
// ═══════════════════════════════════════
function toggleSidebarCollapse() {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    appLayout.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('sidebar-collapsed', isCollapsed ? '1' : '0');
}

function restoreSidebarState() {
    if (localStorage.getItem('sidebar-collapsed') === '1') {
        sidebar.classList.add('collapsed');
        appLayout.classList.add('sidebar-collapsed');
    }
}

collapseBtn.addEventListener('click', toggleSidebarCollapse);

// Allow clicking anywhere on the collapsed sidebar to expand it
sidebar.addEventListener('click', (e) => {
    // Only fire if the sidebar is collapsed and the click isn't on the toggle button itself (handled above)
    // Also ignore clicks on navigation items and links, so they can function without expanding the sidebar
    if (sidebar.classList.contains('collapsed') &&
        !e.target.closest('#sidebar-collapse-btn') &&
        !e.target.closest('.nav-item') &&
        !e.target.closest('.sidebar-link')) {
        toggleSidebarCollapse();
    }
});

// ═══════════════════════════════════════
// ═══════════════════════════════════════
// TOC COLLAPSE
// ═══════════════════════════════════════
function toggleTocCollapse() {
    const isCollapsed = appLayout.classList.toggle('toc-collapsed');
    localStorage.setItem('toc-collapsed', isCollapsed ? '1' : '0');
    tocToggleBtn.classList.toggle('active', !isCollapsed);
}

function restoreTocState() {
    // Force collapsed on initial load if no note is active, otherwise respect local storage
    if (!activeNoteId || localStorage.getItem('toc-collapsed') === '1') {
        appLayout.classList.add('toc-collapsed');
        tocToggleBtn.classList.remove('active');
    } else {
        appLayout.classList.remove('toc-collapsed');
        tocToggleBtn.classList.add('active');
    }
}

tocToggleBtn.addEventListener('click', toggleTocCollapse);

// ═══════════════════════════════════════
// UI AUTO-HIDE (IDLE TIMER)
// ═══════════════════════════════════════
let idleTimer = null;
const IDLE_TIMEOUT = 2500; // 2.5 seconds
const floatingHeader = document.querySelector('.floating-header');

function resetIdleTimer() {
    // Show UI
    if (floatingHeader) floatingHeader.classList.remove('ui-hidden');

    const fab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel-widget');
    const isChatOpen = chatPanel && chatPanel.classList.contains('open');

    if (fab && !isChatOpen) {
        fab.classList.remove('ui-hidden');
    }

    clearTimeout(idleTimer);

    // Set new timer
    idleTimer = setTimeout(() => {
        // Only hide if the sidebar menu isn't open and chat isn't open
        const isSidebarOpen = sidebar.classList.contains('open');
        const isChatOpenNow = chatPanel && chatPanel.classList.contains('open');

        if (!isSidebarOpen && !isChatOpenNow) {
            if (floatingHeader) floatingHeader.classList.add('ui-hidden');
            if (fab) fab.classList.add('ui-hidden');
        }
    }, IDLE_TIMEOUT);
}

// Bind idle listeners to main window
window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('touchstart', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function fetchNotes() {
    try {
        let snapshot;
        try {
            // Try ordered query first
            const q = query(collection(db, 'notes'), orderBy('created_at', 'desc'));
            snapshot = await getDocs(q);
        } catch (indexErr) {
            // Fallback: unordered fetch (works without composite index)
            console.warn('Ordered query failed, falling back:', indexErr.message);
            snapshot = await getDocs(collection(db, 'notes'));
        }

        if (!snapshot.empty) {
            const dbNotes = snapshot.docs.map(docSnap => {
                const dbNote = { id: docSnap.id, ...docSnap.data() };

                // Determine icon based on category
                let icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
                if (dbNote.category === 'RNN') {
                    icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>';
                } else if (dbNote.category === 'CNN') {
                    icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
                }

                return {
                    id: dbNote.id,
                    title: dbNote.title,
                    // jsDelivr CDN URL — proper CORS & MIME types
                    file: dbNote.file_url,
                    isExternalUrl: true,
                    fileType: dbNote.file_type || 'pdf',
                    category: dbNote.category,
                    icon,
                    description: dbNote.description || '',
                    tags: dbNote.tags || [],
                };
            });

            // Combine local static notes with DB notes
            NOTES = [...NOTES, ...dbNotes];
            console.log(`✅ Loaded ${dbNotes.length} note(s) from Firestore`);
        }
    } catch (error) {
        console.error('Error fetching notes from Firebase:', error);
    }
}


async function init() {
    // Fetch data first
    await fetchNotes();

    // Fetch the text content of all notes for full-text search
    await Promise.all(NOTES.map(async (note) => {
        try {
            // ── Local HTML files ──
            if (!note.isExternalUrl && note.file.endsWith('.html')) {
                const response = await fetch(`./notes/${note.file}`);
                if (response.ok) {
                    const html = await response.text();
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    note.textContent = tempDiv.textContent || tempDiv.innerText || '';
                }
            }

            // ── External PDF files – extract via PDF.js ──
            if (note.isExternalUrl && note.fileType === 'pdf' && note.file) {
                const loadingTask = pdfjsLib.getDocument(note.file);
                const pdf = await loadingTask.promise;
                let fullText = '';
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' ';
                }
                note.textContent = fullText.trim();
            }
        } catch (e) {
            console.warn(`Could not index content for "${note.title}":`, e.message);
        }
    }));

    // Render sidebar
    renderNavTree(NOTES);

    // Load from hash or show welcome
    loadNoteFromHash();

    // Restore layout state (must be after hash so activeNoteId is correct)
    restoreSidebarState();
    restoreTocState();

    // Listen to hash changes (back/forward)
    window.addEventListener('hashchange', loadNoteFromHash);
}

init();
