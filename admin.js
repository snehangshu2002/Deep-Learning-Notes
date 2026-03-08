import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';

// ── GITHUB CONFIG ──
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_OWNER = import.meta.env.VITE_GITHUB_OWNER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
const GH_FOLDER = 'public/notes'; // files stored alongside existing local notes

// ── DOM ELEMENTS ──
const authWrapper = document.getElementById('auth-wrapper');
const dashboardWrapper = document.getElementById('dashboard-wrapper');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const loginSpinner = document.getElementById('login-spinner');
const logoutBtn = document.getElementById('logout-btn');
const googleSignInBtn = document.getElementById('google-signin-btn');

const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const selectedFileName = document.getElementById('selected-file-name');
const noteTitle = document.getElementById('note-title');
const noteCategory = document.getElementById('note-category');
const noteDesc = document.getElementById('note-desc');
const noteTags = document.getElementById('note-tags');
const uploadBtn = document.getElementById('upload-btn');
const uploadSpinner = document.getElementById('upload-spinner');
const uploadStatus = document.getElementById('upload-status');

const notesTableBody = document.getElementById('notes-table-body');
const refreshNotesBtn = document.getElementById('refresh-notes');

const ghNotesTableBody = document.getElementById('gh-notes-table-body');
const refreshGhNotesBtn = document.getElementById('refresh-gh-notes');
// ── STATE ──
let selectedFile = null;
let trackedFilePaths = new Set();

// ═══════════════════════════════════════
// AUTHENTICATION (Firebase)
// ═══════════════════════════════════════

onAuthStateChanged(auth, (user) => {
    if (user) {
        showDashboard();
        fetchNotes().then(() => fetchGitHubFiles());
    }
    else { showLogin(); }
});

// ── Google Sign-In ──
googleSignInBtn.addEventListener('click', async () => {
    authError.classList.add('hidden');
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (err) {
        authError.textContent = err.message;
        authError.classList.remove('hidden');
    }
});

// ── Email/Password Sign-In ──
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    loginSpinner.classList.remove('hidden');
    loginForm.querySelector('button span').textContent = 'Authenticating...';
    loginForm.querySelector('button').disabled = true;

    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        loginForm.reset();
    } catch (err) {
        authError.textContent = err.message;
        authError.classList.remove('hidden');
    } finally {
        loginSpinner.classList.add('hidden');
        loginForm.querySelector('button span').textContent = 'Sign In';
        loginForm.querySelector('button').disabled = false;
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

function showDashboard() { authWrapper.classList.add('hidden'); dashboardWrapper.classList.remove('hidden'); }
function showLogin() { authWrapper.classList.remove('hidden'); dashboardWrapper.classList.add('hidden'); }

// ═══════════════════════════════════════
// FILE DRAG & DROP
// ═══════════════════════════════════════

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false));
['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.add('dragover'), false));
['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('dragover'), false));

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', function () { handleFiles(this.files); });

function handleFiles(files) {
    if (!files.length) return;
    const file = files[0];
    const allowed = ['application/pdf', 'text/html', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    const ext = /\.(pdf|html|htm|png|jpg|jpeg|gif|webp|svg)$/i;
    if (!allowed.includes(file.type) && !ext.test(file.name)) {
        showUploadStatus('Unsupported file type. Use PDF, HTML or image.', 'error');
        return;
    }
    selectedFile = file;
    selectedFileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
    selectedFileName.classList.remove('hidden');
    uploadStatus.classList.add('hidden');

    if (!noteTitle.value) {
        let name = file.name.replace(/\.(pdf|html|htm|png|jpg|jpeg|gif|webp|svg)$/i, '');
        name = name.replace(/[-_]/g, ' ').split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        noteTitle.value = name;
    }
}

function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileType(file) {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'text/html' || /\.html?$/i.test(file.name)) return 'html';
    if (file.type.startsWith('image/')) return 'image';
    return 'other';
}

// ═══════════════════════════════════════
// GITHUB API helpers
// ═══════════════════════════════════════

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:...;base64,
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function githubUpload(fileName, base64Content) {
    const path = `${GH_FOLDER}/${fileName}`;
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GH_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Upload note: ${fileName}`,
            content: base64Content,
            branch: GH_BRANCH,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'GitHub upload failed');
    }

    const data = await res.json();
    // Use jsDelivr CDN — has proper CORS headers and correct Content-Type (unlike raw.githubusercontent.com)
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${GH_OWNER}/${GH_REPO}@${GH_BRANCH}/${path}`;
    return { sha: data.content.sha, rawUrl: cdnUrl, path };
}

async function githubDelete(filePath, sha) {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${filePath}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: {
            Authorization: `token ${GH_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Delete note: ${filePath}`,
            sha,
            branch: GH_BRANCH,
        }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'GitHub delete failed');
    }
}

// ═══════════════════════════════════════
// UPLOAD (GitHub + Firestore)
// ═══════════════════════════════════════

function showUploadStatus(msg, type = 'success') {
    uploadStatus.textContent = msg;
    uploadStatus.className = `upload-status ${type}`;
    uploadStatus.classList.remove('hidden');
    if (type === 'success') setTimeout(() => uploadStatus.classList.add('hidden'), 5000);
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) { showUploadStatus('Please select a file.', 'error'); return; }

    const title = noteTitle.value.trim();
    const category = noteCategory.value;
    const desc = noteDesc.value.trim();
    const tags = noteTags.value.trim()
        ? noteTags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

    // Set loading state
    const btnSpan = uploadBtn.querySelector('span') || uploadBtn;
    uploadSpinner.classList.remove('hidden');
    btnSpan.textContent = 'Uploading...';
    uploadBtn.disabled = true;
    uploadStatus.classList.add('hidden');

    try {
        const fileType = getFileType(selectedFile);
        const safeName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // 1. Convert to base64
        const base64 = await toBase64(selectedFile);

        // 2. Upload to GitHub
        uploadStatus.textContent = '⬆️ Uploading to GitHub...';
        uploadStatus.className = 'upload-status success';
        uploadStatus.classList.remove('hidden');
        const { sha, rawUrl, path } = await githubUpload(safeName, base64);

        // 3. Save metadata to Firestore
        uploadStatus.textContent = '💾 Saving metadata...';
        await addDoc(collection(db, 'notes'), {
            title, category,
            description: desc,
            tags,
            file_url: rawUrl,
            file_path: path,
            file_sha: sha,
            file_name: safeName,
            file_type: fileType,
            created_at: serverTimestamp(),
        });

        // 4. Reset UI immediately on success
        uploadSpinner.classList.add('hidden');
        btnSpan.textContent = 'Upload & Save File';
        uploadBtn.disabled = false;

        uploadForm.reset();
        selectedFile = null;
        selectedFileName.classList.add('hidden');

        showUploadStatus('✅ Note uploaded successfully!');
        fetchNotes();

    } catch (err) {
        console.error('Upload error:', err);
        showUploadStatus('❌ ' + err.message, 'error');
        // Always reset button on error
        uploadSpinner.classList.add('hidden');
        const s = uploadBtn.querySelector('span') || uploadBtn;
        s.textContent = 'Upload & Save File';
        uploadBtn.disabled = false;
    }
});


// ═══════════════════════════════════════
// FETCH & DISPLAY NOTES (Firestore)
// ═══════════════════════════════════════

async function fetchNotes() {
    notesTableBody.innerHTML = '<tr><td colspan="5" class="text-center loading-cell">Loading notes...</td></tr>';
    try {
        const snap = await getDocs(query(collection(db, 'notes'), orderBy('created_at', 'desc')));

        if (snap.empty) {
            notesTableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:24px;color:var(--text-muted)">No notes yet.</td></tr>';
            return;
        }

        notesTableBody.innerHTML = '';
        snap.forEach(docSnap => {
            const note = { id: docSnap.id, ...docSnap.data() };
            const date = note.created_at?.toDate
                ? note.created_at.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Just now';
            const typeLabel = { pdf: '📄 PDF', html: '🌐 HTML', image: '🖼️ Image' }[note.file_type] || '📁 File';

            // Track file paths that exist in Firestore
            if (note.file_name) trackedFilePaths.add(note.file_name);
            if (note.file_path) trackedFilePaths.add(note.file_path);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td><strong>${note.title}</strong></td>
                    <td><span class="badge cat-${note.category}">${note.category}</span></td>
                    <td><span style="font-size:.8rem;color:var(--text-muted)">${typeLabel}</span></td>
                    <td style="color:var(--text-muted);font-size:.85rem">${date}</td>
                    <td>
                        <div style="display:flex;gap:8px">
                            <a href="${note.file_url}" target="_blank" class="icon-btn" title="View file">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </a>
                            <button class="icon-btn delete-btn"
                                data-id="${note.id}"
                                data-path="${note.file_path || ''}"
                                data-sha="${note.file_sha || ''}"
                                title="Delete">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--danger)" stroke-width="2" fill="none">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>`;
            notesTableBody.appendChild(tr);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { id, path, sha } = e.currentTarget.dataset;
                deleteNote(id, path, sha);
            });
        });

    } catch (err) {
        notesTableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--danger)">Error: ${err.message}</td></tr>`;
    }
}

refreshNotesBtn.addEventListener('click', () => {
    const icon = refreshNotesBtn.querySelector('svg');
    icon.style.cssText = 'transform:rotate(180deg);transition:transform .3s';
    fetchNotes().then(() => setTimeout(() => icon.style.transform = 'none', 300));
});

// ═══════════════════════════════════════
// FETCH GITHUB FILES
// ═══════════════════════════════════════
async function fetchGitHubFiles() {
    ghNotesTableBody.innerHTML = '<tr><td colspan="4" class="text-center loading-cell">Fetching from GitHub...</td></tr>';
    try {
        const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FOLDER}?ref=${GH_BRANCH}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `token ${GH_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            if (res.status === 404) {
                // Folder hasn't been created yet / is empty
                ghNotesTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:24px;color:var(--text-muted)">No files found in GitHub yet.</td></tr>';
                return;
            }
            throw new Error(`GitHub API Error: ${res.status}`);
        }

        let files = await res.json();
        // filter out non-files if any directories exist
        files = files.filter(f => f.type === 'file');

        if (files.length === 0) {
            ghNotesTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:24px;color:var(--text-muted)">No files found in GitHub.</td></tr>';
            return;
        }

        // Sort descending by name as a proxy for date since GitHub contents API doesn't return dates
        files.sort((a, b) => b.name.localeCompare(a.name));

        ghNotesTableBody.innerHTML = '';
        files.forEach(file => {
            const isTracked = trackedFilePaths.has(file.name) || trackedFilePaths.has(file.path);
            const statusBadge = isTracked
                ? '<span class="badge" style="background:rgba(16,185,129,0.15);color:#34d399">Synced</span>'
                : '<span class="badge" style="background:rgba(245,158,11,0.15);color:#fbbf24">Untracked</span>';

            const sizeKb = (file.size / 1024).toFixed(1) + ' KB';
            const cdnUrl = `https://cdn.jsdelivr.net/gh/${GH_OWNER}/${GH_REPO}@${GH_BRANCH}/${file.path}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${file.name}</strong></td>
                <td style="color:var(--text-muted);font-size:.85rem">${sizeKb}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex;gap:8px">
                        <a href="${file.html_url}" target="_blank" class="icon-btn" title="View on GitHub">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                            </svg>
                        </a>
                        <button class="icon-btn delete-gh-btn"
                            data-path="${file.path}"
                            data-sha="${file.sha}"
                            title="Delete file from GitHub">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--danger)" stroke-width="2" fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        ${!isTracked ? `
                        <button class="icon-btn sync-gh-btn"
                            data-name="${file.name}"
                            data-path="${file.path}"
                            data-url="${cdnUrl}"
                            title="Add to Database">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--success)" stroke-width="2" fill="none">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                <polyline points="9 12 11 14 15 10"></polyline>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </td>`;
            ghNotesTableBody.appendChild(tr);
        });

        // Add delete listeners for GitHub files
        document.querySelectorAll('.delete-gh-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Delete this file permanently from GitHub? This cannot be undone.')) return;
                const { path, sha } = e.currentTarget.dataset;
                try {
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';
                    await githubDelete(path, sha);
                    showUploadStatus(`Deleted ${path} from GitHub`);
                    fetchGitHubFiles();
                } catch (err) {
                    alert('GitHub delete failed: ' + err.message);
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            });
        });

        // Add sync listeners for Untracked files
        document.querySelectorAll('.sync-gh-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const { name, path, url } = e.currentTarget.dataset;

                // Prompt user for category and title
                let title = name.replace(/\.(pdf|html|htm|png|jpg|jpeg|gif|webp|svg)$/i, '');
                title = title.replace(/[-_]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                const confirmedTitle = prompt(`Enter a title for this note:`, title);
                if (!confirmedTitle) return;

                const categoryStr = prompt(`Enter exactly ONE of these categories:\nBasics, RNN, LSTM, Transformers, CNN, Optimization, Advanced`, 'Basics');
                if (!categoryStr) return;

                // Determine type based on extension
                let extMatch = name.match(/\.([^.]+)$/);
                let ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
                let fileType = 'pdf';
                if (['html', 'htm'].includes(ext)) fileType = 'html';
                if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) fileType = 'image';

                try {
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';

                    await addDoc(collection(db, 'notes'), {
                        title: confirmedTitle,
                        category: categoryStr,
                        description: 'Imported from GitHub',
                        tags: [],
                        file_name: name,
                        file_path: path,
                        file_url: url,
                        file_type: fileType,
                        created_at: serverTimestamp()
                    });

                    showUploadStatus(`Synced ${name} to database!`, 'success');
                    fetchNotes().then(() => fetchGitHubFiles()); // Refresh both tables
                } catch (err) {
                    alert('Sync failed: ' + err.message);
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            });
        });

    } catch (err) {
        ghNotesTableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--danger)">Error: ${err.message}</td></tr>`;
    }
}

refreshGhNotesBtn.addEventListener('click', () => {
    const icon = refreshGhNotesBtn.querySelector('svg');
    icon.style.cssText = 'transform:rotate(180deg);transition:transform .3s';
    fetchGitHubFiles().then(() => setTimeout(() => icon.style.transform = 'none', 300));
});

// ═══════════════════════════════════════
// DELETE (GitHub + Firestore)
// ═══════════════════════════════════════

async function deleteNote(id, filePath, sha) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    try {
        // Try to delete from GitHub (non-blocking — still removes Firestore entry if this fails)
        if (filePath && sha) {
            try { await githubDelete(filePath, sha); }
            catch (ghErr) { console.warn('GitHub delete skipped:', ghErr.message); }
        }
        await deleteDoc(doc(db, 'notes', id));
        showUploadStatus('Note deleted successfully.');
        fetchNotes();
    } catch (err) {
        alert(`Failed to delete: ${err.message} `);
    }
}
