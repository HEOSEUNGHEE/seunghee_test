// --- 1. Supabase 클라이언트 설정 ---
const supabaseUrl = 'https://avixgddflovoloctluvt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aXhnZGRmbG92b2xvY3RsdXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODMxMDIsImV4cCI6MjA2OTk1OTEwMn0.E2Mk8fNuHxcnuMFCKqiXPI3BoZ5H5_DxoWFjaHHw_Zk';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 상태 관리 변수 ---
let currentView = 'list';
let currentPage = 1;
const postsPerPage = 10;
let currentFilter = '전체';
let currentPostId = null;
let editor = null; // Toast UI Editor 인스턴스를 저장할 변수
let uploadedFiles = []; // 업로드된 파일 목록
let isUploading = false; // 업로드 중복 방지 플래그

// --- DOM 요소 ---
const views = {
    list: document.getElementById('list-view'),
    detail: document.getElementById('detail-view'),
    editor: document.getElementById('editor-view'),
};
const breadcrumb = document.getElementById('breadcrumb');

// --- 함수 ---

/** 날짜 포맷팅 함수 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/** 뷰 전환 함수 */
async function showView(viewName, postId = null) {
    currentView = viewName;
    currentPostId = postId;

    if (editor) {
        editor.destroy();
        editor = null;
    }

    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    
    // Breadcrumb 업데이트
    if(viewName === 'list') {
        breadcrumb.textContent = 'Home > 공지사항';
    } else if (viewName === 'detail') {
        breadcrumb.textContent = 'Home > 공지사항 > 상세';
    } else if (viewName === 'editor') {
        breadcrumb.textContent = `Home > 공지사항 > ${postId ? '수정' : '작성'}`;
    }


    if (viewName === 'editor') {
        await renderEditorView(postId);
    } else if (viewName === 'list') {
        await renderListView();
    } else if (viewName === 'detail' && postId) {
        await renderDetailView(postId);
    }
}

/** 목록 뷰 렌더링 */
async function renderListView() {
    const tableBody = document.getElementById('notice-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10">데이터를 불러오는 중...</td></tr>';

    let query = supabaseClient.from('posts').select('*', { count: 'exact' });

    if (currentFilter !== '전체') {
        query = currentFilter === '중요' ? query.eq('is_important', true) : query.eq('category', currentFilter);
    }

    const startIndex = (currentPage - 1) * postsPerPage;
    query = query.order('is_fixed', { ascending: false }).order('created_at', { ascending: false }).range(startIndex, startIndex + postsPerPage - 1);

    const { data: posts, error, count } = await query;

    if (error) {
        console.error('Error fetching posts:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">데이터 로딩 실패</td></tr>';
        return;
    }

    if (posts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10">게시글이 없습니다.</td></tr>';
    } else {
        tableBody.innerHTML = posts.map((post, index) => {
            const postNumber = count - startIndex - index;
            
            const attachmentCount = post.attachments ? post.attachments.length : 0;
            let attachmentText = '';
            if (attachmentCount > 0) {
                const lastFile = post.attachments[attachmentCount - 1];
                if (attachmentCount > 1) {
                    attachmentText = `${lastFile.name} 외 ${attachmentCount - 1}개`;
                } else {
                    attachmentText = lastFile.name;
                }
            }

            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="text-center py-3 px-4">${post.is_fixed ? '<span class="text-red-500 font-bold">공지</span>' : postNumber}</td>
                    <td class="py-3 px-4 truncate"><a href="#" class="hover:underline" onclick="event.preventDefault(); showView('detail', ${post.id})">${post.title}</a></td>
                    <td class="text-center py-3 px-4">${post.category}</td>
                    <td class="text-center py-3 px-4">${post.is_important ? '✔️' : ''}</td>
                    <td class="text-center py-3 px-4 text-sm truncate" title="${attachmentText}">${attachmentText}</td>
                    <td class="text-center py-3 px-4 text-sm">${formatDate(post.created_at)}</td>
                </tr>`;
        }).join('');
    }
    renderPagination(Math.ceil(count / postsPerPage));
}

/** 페이지네이션 렌더링 */
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-3 py-1 rounded ${currentPage === i ? 'bg-blue-500 text-white' : 'bg-gray-200'}`;
        pageButton.onclick = async () => { currentPage = i; await renderListView(); };
        paginationContainer.appendChild(pageButton);
    }
}

/** 퀵 필터 버튼 렌더링 */
function renderQuickFilterButtons() {
    const container = document.getElementById('quick-filter-buttons');
    container.innerHTML = '';
    const filters = ['전체', '요율', '통관', '물류센터', '시스템(업데이트)', '뉴스', '중요'];
    
    filters.forEach(filter => {
        const button = document.createElement('button');
        button.textContent = filter;
        button.className = `quick-filter-btn ${filter === currentFilter ? 'active' : ''}`;
        button.onclick = async () => {
            currentFilter = filter;
            currentPage = 1;
            renderQuickFilterButtons();
            await renderListView();
        };
        container.appendChild(button);
    });
}

/** 상세 뷰 렌더링 */
async function renderDetailView(postId) {
    const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();

    if (error || !post) {
        console.error('Error fetching post:', error);
        alert('게시글을 불러오지 못했습니다.');
        return showView('list');
    }

    document.getElementById('detail-category').textContent = post.category;
    document.getElementById('detail-date').textContent = formatDate(post.created_at);
    document.getElementById('detail-title').textContent = post.title;
    document.getElementById('detail-body').innerHTML = post.content;

    renderAttachments(post.attachments || []);

    document.getElementById('edit-btn').onclick = () => showView('editor', postId);
    document.getElementById('delete-btn').onclick = () => handleDeletePost(postId);
    
    await updatePrevNextButtons(post.created_at, post.is_fixed);
}

/** 첨부파일 렌더링 */
function renderAttachments(attachments) {
    const container = document.getElementById('detail-attachment-container');
    if (!attachments || attachments.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');

    const attachmentList = attachments.map(file => `
        <button onclick="downloadFile('${file.url}', '${file.name}')" class="flex items-center gap-2 p-2 bg-gray-50 rounded border hover:bg-gray-100 w-full text-left">
            <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
            </svg>
            <span class="text-sm text-gray-700 truncate" title="${file.name}">${file.name}</span>
        </button>
    `).join('');

    container.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-700 mb-2">첨부파일 (${attachments.length}개)</h4>
        <div class="space-y-2">
            ${attachmentList}
        </div>
    `;
}

/** 파일 다운로드 함수 */
async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok.');
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('Download error:', error);
        alert('파일 다운로드에 실패했습니다.');
    }
}

/** 이전/다음글 버튼 업데이트 */
async function updatePrevNextButtons(currentPostDate, isFixed) {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // 이전 글 찾기
    const { data: prevPost } = await supabaseClient.from('posts')
        .select('id')
        .lt('created_at', currentPostDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    // 다음 글 찾기
    const { data: nextPost } = await supabaseClient.from('posts')
        .select('id')
        .gt('created_at', currentPostDate)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    if (prevPost) {
        prevBtn.style.display = 'inline-block';
        prevBtn.onclick = () => showView('detail', prevPost.id);
    } else {
        prevBtn.style.display = 'none';
    }

    if (nextPost) {
        nextBtn.style.display = 'inline-block';
        nextBtn.onclick = () => showView('detail', nextPost.id);
    } else {
        nextBtn.style.display = 'none';
    }
}


/** 작성/수정 뷰 렌더링 (Toast UI Editor) */
async function renderEditorView(postId = null) {
    const form = document.getElementById('editor-form');
    form.reset();
    document.getElementById('post-id').value = '';
    uploadedFiles = [];
    renderFileList();

    let initialContent = "";
    if (postId) {
        const { data: post } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
        if (post) {
            document.getElementById('post-id').value = post.id;
            document.getElementById('title').value = post.title;
            document.getElementById('category').value = post.category;
            document.getElementById('is-fixed').checked = post.is_fixed;
            document.getElementById('is-important').checked = post.is_important;
            initialContent = post.content;
            uploadedFiles = post.attachments || [];
            renderFileList();
        }
    }

    setupFileUpload();

    editor = new toastui.Editor({
        el: document.querySelector('#editor'),
        height: '400px',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        initialValue: initialContent,
        hooks: {
            addImageBlobHook: async (blob, callback) => {
                const publicUrl = await handleImageUpload(blob);
                if (publicUrl) {
                    callback(publicUrl, 'alt text');
                }
            }
        }
    });
}

/** 파일 업로드 설정 */
function setupFileUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    const dragOverHandler = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    };
    const dragLeaveHandler = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    };
    const dropHandler = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        const files = Array.from(e.dataTransfer.files);
        handleFileUpload(files);
    };
    const changeHandler = (e) => {
        const files = Array.from(e.target.files);
        handleFileUpload(files);
        e.target.value = ''; // 동일한 파일 다시 선택 가능하도록 초기화
    };

    dropZone.removeEventListener('dragover', dragOverHandler);
    dropZone.removeEventListener('dragleave', dragLeaveHandler);
    dropZone.removeEventListener('drop', dropHandler);
    fileInput.removeEventListener('change', changeHandler);
    
    dropZone.addEventListener('dragover', dragOverHandler);
    dropZone.addEventListener('dragleave', dragLeaveHandler);
    dropZone.addEventListener('drop', dropHandler);
    fileInput.addEventListener('change', changeHandler);
}

/** 파일 업로드 처리 (중복 방지) */
async function handleFileUpload(files) {
    if (isUploading) {
        alert("파일 업로드 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    isUploading = true;
    
    const newFiles = files.filter(file => 
        !uploadedFiles.some(uploadedFile => 
            uploadedFile.name === file.name && uploadedFile.size === file.size
        )
    );

    if (newFiles.length !== files.length) {
        alert("중복된 파일은 제외되었습니다.");
    }
    
    if(newFiles.length === 0) {
        isUploading = false;
        return;
    }

    try {
        for (const file of newFiles) {
            const fileUrl = await uploadFile(file);
            if (fileUrl) {
                uploadedFiles.push({
                    name: file.name,
                    url: fileUrl,
                    size: file.size,
                    type: file.type
                });
            }
        }
        renderFileList();
    } catch (error) {
        console.error('File upload error:', error);
        alert(`파일 업로드 중 오류가 발생했습니다.`);
    } finally {
        isUploading = false;
    }
}

/** 파일 업로드 (Supabase 스토리지) */
async function uploadFile(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `attachments/${fileName}`;

    const { error } = await supabaseClient.storage.from('images').upload(filePath, file);

    if (error) {
        throw new Error('파일 업로드에 실패했습니다: ' + error.message);
    }

    const { data: { publicUrl } } = supabaseClient.storage.from('images').getPublicUrl(filePath);
    return publicUrl;
}

/** 파일 목록 렌더링 */
function renderFileList() {
    const fileList = document.getElementById('file-list');
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    const fileItems = uploadedFiles.map((file, index) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded border mb-2">
            <div class="flex items-center gap-2 overflow-hidden">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                </svg>
                <span class="text-sm text-gray-700 truncate">${file.name}</span>
                <span class="text-xs text-gray-500 flex-shrink-0">(${formatFileSize(file.size)})</span>
            </div>
            <button onclick="removeFile(${index})" class="text-red-600 hover:text-red-800 text-sm ml-2">
                삭제
            </button>
        </div>
    `).join('');

    fileList.innerHTML = fileItems;
}

/** 파일 크기 포맷팅 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** 파일 제거 */
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderFileList();
}

/** 새 글 작성 핸들러 */
function handleNewPost() {
    showView('editor');
}

/** 저장 버튼 클릭 시 실행될 함수 */
async function savePost() {
    if (!editor) {
        alert('에디터가 초기화되지 않았습니다.');
        return;
    }

    const title = document.getElementById('title').value.trim();
    const content = editor.getHTML();

    if (!title || content.trim() === "" || content.trim() === "<p><br></p>") {
        alert('제목과 내용은 필수입니다.');
        return;
    }
    
    await handleSavePost(content);
}

/** 게시글 저장 (Supabase 연동) */
async function handleSavePost(content) {
    const id = document.getElementById('post-id').value;
    const postData = {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value,
        is_fixed: document.getElementById('is-fixed').checked,
        is_important: document.getElementById('is-important').checked,
        content: content,
        attachments: uploadedFiles
    };

    const { error } = id 
        ? await supabaseClient.from('posts').update(postData).eq('id', id)
        : await supabaseClient.from('posts').insert(postData);

    if (error) {
        console.error('Error saving post:', error);
        alert('저장에 실패했습니다: ' + error.message);
    } else {
        alert('저장되었습니다.');
        showView('list');
    }
}

/** 게시글 삭제 핸들러 */
function handleDeletePost(postId) {
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('confirm-delete').onclick = async () => {
        const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
        if (error) {
            console.error('Error deleting post:', error);
            alert('삭제에 실패했습니다: ' + error.message);
        } else {
            alert('삭제되었습니다.');
            showView('list');
        }
        modal.classList.add('hidden');
    };
}

/** 이미지 업로드 기능 (Supabase 스토리지) */
async function handleImageUpload(file) {
    if (!file) return null;
    if (isUploading) return null;
    isUploading = true;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `images/${fileName}`;

        const { error } = await supabaseClient.storage.from('images').upload(filePath, file);

        if (error) {
            console.error('Error uploading image:', error);
            alert('이미지 업로드에 실패했습니다.');
            return null;
        }

        const { data: { publicUrl } } = supabaseClient.storage.from('images').getPublicUrl(filePath);
        return publicUrl;
    } finally {
        isUploading = false;
    }
}

// --- 페이지 로드 시 초기화 ---
window.onload = function() {
    renderQuickFilterButtons();
    showView('list');
    
    document.getElementById('editor-form').addEventListener('submit', (e) => e.preventDefault());

    // 모달 이벤트 리스너
    document.getElementById('cancel-delete').addEventListener('click', () => {
        document.getElementById('delete-confirm-modal').classList.add('hidden');
    });
};
