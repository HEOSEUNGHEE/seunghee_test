// --- 1. Supabase 클라이언트 설정 ---
const supabaseUrl = 'https://avixgddflovoloctluvt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aXhnZGRmbG92b2xvY3RsdXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODMxMDIsImV4cCI6MjA2OTk1OTEwMn0.E2Mk8fNuHxcnuMFCKqiXPI3BoZ5H5_DxoWFjaHHw_Zk';

// Supabase 클라이언트 초기화 (전역 객체 확인)
let supabaseClient;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.error('Supabase library not loaded');
}

// --- 상태 관리 변수 ---
let currentView = 'list';
let currentPage = 1;
let postsPerPage = 20;
let currentFilter = '전체';
let uploadedFiles = [];
let isUploading = false;
let editor = null;

// --- 유틸리티 함수 ---
function formatDate(dateString) {
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// --- 뷰 전환 함수 ---
async function showView(viewName, postId = null) {
    currentView = viewName;
    
    // 모든 뷰 숨기기
    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('editor-view').classList.add('hidden');
    
    // 탭 활성화 상태 업데이트
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('tab-active');
        tab.classList.add('tab-inactive');
    });
    
    // 헤더 제목과 브레드크럼 업데이트
    const headerTitle = document.querySelector('h1');
    const breadcrumb = document.querySelector('p.text-sm.text-gray-500');
    
    switch (viewName) {
        case 'list':
            document.getElementById('list-view').classList.remove('hidden');
            document.getElementById('list-tab').classList.add('tab-active');
            document.getElementById('list-tab').classList.remove('tab-inactive');
            headerTitle.textContent = '공지사항';
            breadcrumb.textContent = 'Home > 공지사항';
            await renderListView();
            break;
            
        case 'detail':
            document.getElementById('detail-view').classList.remove('hidden');
            headerTitle.textContent = '공지사항';
            breadcrumb.textContent = 'Home > 공지사항';
            if (postId) {
                await renderDetailView(postId);
            }
            break;
            
        case 'editor':
            document.getElementById('editor-view').classList.remove('hidden');
            headerTitle.textContent = postId ? '공지사항 수정' : '공지사항 작성';
            breadcrumb.textContent = 'Home > 공지사항';
            await renderEditorView(postId);
            break;
    }
    
    // 파일 업로드 설정을 약간의 지연 후에 실행
    setTimeout(() => {
        setupFileUpload();
    }, 100);
}

// --- 목록 뷰 렌더링 ---
async function renderListView() {
    console.log('renderListView called');
    
    // Supabase 클라이언트 확인
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        const tableBody = document.getElementById('notice-table-body');
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">Supabase 연결 오류</td></tr>';
        return;
    }
    
    const tableBody = document.getElementById('notice-table-body');
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10">데이터를 불러오는 중...</td></tr>';

    let query = supabaseClient.from('posts').select('*', { count: 'exact' });

    if (currentFilter !== '전체') {
        query = currentFilter === '중요' ? query.eq('is_important', true) : query.eq('category', currentFilter);
    }

    const startIndex = (currentPage - 1) * postsPerPage;
    query = query.order('is_fixed', { ascending: false }).order('created_at', { ascending: false }).range(startIndex, startIndex + postsPerPage - 1);

    console.log('Executing query with startIndex:', startIndex, 'postsPerPage:', postsPerPage);
    const { data: posts, error, count } = await query;

    if (error) {
        console.error('Error fetching posts:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">데이터를 불러오는데 실패했습니다.</td></tr>';
        return;
    }

    if (!posts || posts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">등록된 게시글이 없습니다.</td></tr>';
        renderPagination(0);
        return;
    }

    // 게시글 번호 계산 (전체 게시글 기준)
    const postNumber = startIndex + 1;

    tableBody.innerHTML = posts.map((post, index) => {
        // 첨부파일 텍스트 생성
        let attachmentText = '';
        if (post.attachments && Array.isArray(post.attachments) && post.attachments.length > 0) {
            if (post.attachments.length === 1) {
                attachmentText = post.attachments[0].name;
            } else {
                const lastFile = post.attachments[post.attachments.length - 1];
                attachmentText = `${lastFile.name} 외 ${post.attachments.length - 1}개`;
            }
        }

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="text-center py-3 px-4">${post.is_fixed ? '<span class="text-red-500 font-bold">공지</span>' : postNumber + index}</td>
                <td class="py-3 px-4 truncate">
                    <a href="#" class="hover:underline" onclick="event.preventDefault(); showView('detail', ${post.id})">
                        ${post.title}
                    </a>
                </td>
                <td class="text-center py-3 px-4">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${post.category}</span>
                </td>
                <td class="text-center py-3 px-4">${post.is_important ? '✔️' : ''}</td>
                <td class="text-center py-3 px-4">${attachmentText}</td>
                <td class="text-center py-3 px-4 text-sm">${formatDate(post.created_at)}</td>
            </tr>`;
    }).join('');
    
    // 페이지네이션 렌더링 (전체 게시글 수 사용)
    const totalPages = Math.ceil(count / postsPerPage);
    renderPagination(totalPages);
}

// --- 페이지네이션 렌더링 ---
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }

    // 첫 페이지 버튼
    const firstButton = document.createElement('button');
    firstButton.innerHTML = '⟪';
    firstButton.title = '첫 페이지';
    firstButton.className = `px-2 py-1 text-sm border rounded hover:bg-gray-100 ${currentPage > 1 ? '' : 'opacity-50 cursor-not-allowed'}`;
    if (currentPage > 1) {
        firstButton.onclick = async () => { 
            currentPage = 1; 
            await renderListView(); 
        };
    } else {
        firstButton.disabled = true;
    }
    paginationContainer.appendChild(firstButton);

    // 이전 페이지 버튼
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '‹';
    prevButton.title = '이전 페이지';
    prevButton.className = `px-2 py-1 text-sm border rounded hover:bg-gray-100 ${currentPage > 1 ? '' : 'opacity-50 cursor-not-allowed'}`;
    if (currentPage > 1) {
        prevButton.onclick = async () => { 
            currentPage--; 
            await renderListView(); 
        };
    } else {
        prevButton.disabled = true;
    }
    paginationContainer.appendChild(prevButton);

    // 현재 페이지 / 총 페이지 표시
    const pageInfoSpan = document.createElement('span');
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
    pageInfoSpan.className = 'px-3 py-1 text-sm text-gray-600';
    paginationContainer.appendChild(pageInfoSpan);

    // 다음 페이지 버튼
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '›';
    nextButton.title = '다음 페이지';
    nextButton.className = `px-2 py-1 text-sm border rounded hover:bg-gray-100 ${currentPage < totalPages ? '' : 'opacity-50 cursor-not-allowed'}`;
    if (currentPage < totalPages) {
        nextButton.onclick = async () => { 
            currentPage++; 
            await renderListView(); 
        };
    } else {
        nextButton.disabled = true;
    }
    paginationContainer.appendChild(nextButton);

    // 마지막 페이지 버튼
    const lastButton = document.createElement('button');
    lastButton.innerHTML = '⟫';
    lastButton.title = '마지막 페이지';
    lastButton.className = `px-2 py-1 text-sm border rounded hover:bg-gray-100 ${currentPage < totalPages ? '' : 'opacity-50 cursor-not-allowed'}`;
    if (currentPage < totalPages) {
        lastButton.onclick = async () => { 
            currentPage = totalPages; 
            await renderListView(); 
        };
    } else {
        lastButton.disabled = true;
    }
    paginationContainer.appendChild(lastButton);
}

// --- 페이지 크기 변경 함수 ---
function changePageSize() {
    const selector = document.getElementById('page-size-selector');
    postsPerPage = parseInt(selector.value);
    currentPage = 1; // 페이지 크기가 변경되면 첫 페이지로 이동
    renderListView();
}

// --- 퀵 필터 버튼 렌더링 ---
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

// --- 상세 뷰 렌더링 ---
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
    // Toast UI Editor는 HTML을 그대로 저장하므로, innerHTML로 렌더링
    document.getElementById('detail-body').innerHTML = post.content;

    // 첨부파일 렌더링 (안전한 접근)
    const attachments = post.attachments && Array.isArray(post.attachments) ? post.attachments : [];
    console.log('Detail view attachments:', attachments);
    renderAttachments(attachments);

    document.getElementById('edit-btn').onclick = () => showView('editor', postId);
    document.getElementById('delete-btn').onclick = () => handleDeletePost(postId);
    
    // 이전글/다음글 버튼 상태 업데이트
    await updatePrevNextButtons(postId);
}

// --- 첨부파일 렌더링 ---
function renderAttachments(attachments) {
    const container = document.getElementById('detail-attachment-container');
    if (!attachments || attachments.length === 0) {
        container.innerHTML = '';
        return;
    }

    const attachmentList = attachments.map(file => `
        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
            </svg>
            <span class="text-sm text-blue-600 hover:text-blue-800 cursor-pointer" onclick="downloadFile('${file.url}', '${file.name}')">
                ${file.name}
            </span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="text-sm text-gray-600 mb-2">첨부파일 (${attachments.length}개)</div>
        <div class="space-y-1">
            ${attachmentList}
        </div>
    `;
}

// --- 파일 다운로드 함수 ---
async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
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
        console.error('Error downloading file:', error);
        alert('파일 다운로드에 실패했습니다.');
    }
}

// --- 에디터 뷰 렌더링 ---
async function renderEditorView(postId = null) {
    // 기존 에디터 제거
    if (editor) {
        editor.destroy();
        editor = null;
    }

    // 첨부파일 초기화
    uploadedFiles = [];
    renderFileList();

    // Toast UI Editor 초기화
    editor = new toastui.Editor({
        el: document.getElementById('editor'),
        height: '400px',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        toolbarItems: [
            ['heading', 'bold', 'italic', 'strike'],
            ['hr', 'quote'],
            ['ul', 'ol', 'task', 'indent', 'outdent'],
            ['table', 'image', 'link'],
            ['code', 'codeblock'],
            ['scrollSync']
        ]
    });

    // 이미지 업로드 훅 설정
    editor.addHook('addImageBlobHook', handleImageUpload);

    // 이미지 리사이즈 설정
    setupImageResize();

    if (postId) {
        // 수정 모드: 기존 데이터 로드
        const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
        
        if (error || !post) {
            alert('게시글을 불러오지 못했습니다.');
            return showView('list');
        }

        document.getElementById('post-id').value = postId;
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-category').value = post.category;
        document.getElementById('post-important').checked = post.is_important;
        document.getElementById('post-fixed').checked = post.is_fixed;
        
        // 에디터에 내용 설정
        editor.setHTML(post.content);
        
        // 첨부파일 설정
        if (post.attachments && Array.isArray(post.attachments)) {
            uploadedFiles = [...post.attachments];
            renderFileList();
        }
    } else {
        // 새 글 작성 모드: 폼 초기화
        document.getElementById('post-id').value = '';
        document.getElementById('post-title').value = '';
        document.getElementById('post-category').value = '뉴스';
        document.getElementById('post-important').checked = false;
        document.getElementById('post-fixed').checked = false;
        editor.setHTML('');
    }
}

// --- 파일 업로드 설정 ---
function setupFileUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    if (!dropZone || !fileInput) {
        console.log('File upload elements not found');
        return;
    }

    // 기존 이벤트 리스너 제거
    dropZone.removeEventListener('dragover', handleDragOver);
    dropZone.removeEventListener('dragleave', handleDragLeave);
    dropZone.removeEventListener('drop', handleDrop);
    fileInput.removeEventListener('change', handleFileChange);

    // 새 이벤트 리스너 추가
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileChange);
}

// --- 드래그 앤 드롭 이벤트 핸들러 ---
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
}

function handleFileChange(e) {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
}

// --- 파일 업로드 처리 ---
async function handleFileUpload(files) {
    console.log('handleFileUpload called with files:', files);
    
    for (const file of files) {
        try {
            const uploadedFile = await uploadFile(file);
            if (uploadedFile) {
                uploadedFiles.push(uploadedFile);
                console.log('File uploaded successfully:', uploadedFile);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert(`파일 업로드 실패: ${file.name}`);
        }
    }
    
    renderFileList();
}

// --- 파일 업로드 함수 ---
async function uploadFile(file) {
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return null;
    }

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabaseClient.storage
            .from('images')
            .upload(fileName, file);

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: { publicUrl } } = supabaseClient.storage
            .from('images')
            .getPublicUrl(fileName);

        return {
            name: file.name,
            url: publicUrl,
            size: file.size
        };
    } catch (error) {
        console.error('Upload exception:', error);
        return null;
    }
}

// --- 파일 목록 렌더링 ---
function renderFileList() {
    const container = document.getElementById('file-list');
    if (!container) return;

    if (uploadedFiles.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">첨부된 파일이 없습니다.</p>';
        return;
    }

    const fileList = uploadedFiles.map((file, index) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded border">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                </svg>
                <span class="text-sm">${file.name}</span>
                <span class="text-xs text-gray-500">(${formatFileSize(file.size)})</span>
            </div>
            <button onclick="removeFile(${index})" class="text-red-500 hover:text-red-700">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `).join('');

    container.innerHTML = fileList;
}

// --- 파일 크기 포맷팅 ---
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- 파일 제거 ---
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderFileList();
}

// --- 새 게시글 작성 ---
function handleNewPost() {
    console.log('handleNewPost called');
    
    // Supabase 클라이언트 확인
    if (!supabaseClient) {
        console.error('Supabase client not initialized in handleNewPost');
        alert('Supabase 연결 오류가 발생했습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    showView('editor');
}

// --- 게시글 저장 ---
async function savePost() {
    if (!editor) {
        alert('에디터가 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    const title = document.getElementById('post-title').value.trim();
    const category = document.getElementById('post-category').value;
    const isImportant = document.getElementById('post-important').checked;
    const isFixed = document.getElementById('post-fixed').checked;
    const content = editor.getHTML();

    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }

    if (!content || content === '<p><br></p>') {
        alert('내용을 입력해주세요.');
        return;
    }

    const postId = document.getElementById('post-id').value;
    
    try {
        const postData = {
            title: title,
            category: category,
            content: content,
            is_important: isImportant,
            is_fixed: isFixed,
            attachments: uploadedFiles || []
        };

        let result;
        if (postId) {
            // 수정
            result = await supabaseClient.from('posts').update(postData).eq('id', postId).select();
        } else {
            // 새 글 작성
            result = await supabaseClient.from('posts').insert(postData).select();
        }

        if (result.error) {
            console.error('Save error:', result.error);
            alert('저장에 실패했습니다: ' + result.error.message);
            return;
        }

        alert(postId ? '게시글이 수정되었습니다.' : '게시글이 작성되었습니다.');
        showView('list');
    } catch (error) {
        console.error('Save exception:', error);
        alert('저장에 실패했습니다.');
    }
}

// --- 게시글 삭제 ---
async function handleDeletePost(postId) {
    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
        
        if (error) {
            console.error('Delete error:', error);
            alert('삭제에 실패했습니다: ' + error.message);
            return;
        }

        alert('게시글이 삭제되었습니다.');
        showView('list');
    } catch (error) {
        console.error('Delete exception:', error);
        alert('삭제에 실패했습니다.');
    }
}

// --- 이전/다음 게시글 처리 ---
async function handlePrevNextPost(currentPostId, direction) {
    try {
        const { data: currentPost } = await supabaseClient
            .from('posts')
            .select('created_at')
            .eq('id', currentPostId)
            .single();
            
        if (!currentPost) {
            alert('현재 게시글을 찾을 수 없습니다.');
            return;
        }

        let query = supabaseClient
            .from('posts')
            .select('id')
            .order('created_at', { ascending: direction === 'next' });

        if (direction === 'prev') {
            query = query.lt('created_at', currentPost.created_at);
        } else {
            query = query.gt('created_at', currentPost.created_at);
        }

        const { data: targetPost, error } = await query.limit(1).single();

        if (error || !targetPost) {
            alert(direction === 'prev' ? '이전 게시글이 없습니다.' : '다음 게시글이 없습니다.');
            return;
        }

        showView('detail', targetPost.id);
    } catch (error) {
        console.error('Error navigating to prev/next post:', error);
        alert('게시글 이동에 실패했습니다.');
    }
}

// --- 이전/다음 버튼 상태 업데이트 ---
async function updatePrevNextButtons(currentPostId) {
    try {
        const { data: currentPost } = await supabaseClient
            .from('posts')
            .select('created_at')
            .eq('id', currentPostId)
            .single();
            
        if (!currentPost) return;

        // 이전 게시글 확인
        const { data: prevPost } = await supabaseClient
            .from('posts')
            .select('id')
            .lt('created_at', currentPost.created_at)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 다음 게시글 확인
        const { data: nextPost } = await supabaseClient
            .from('posts')
            .select('id')
            .gt('created_at', currentPost.created_at)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (prevBtn) {
            if (prevPost) {
                prevBtn.disabled = false;
                prevBtn.onclick = () => handlePrevNextPost(currentPostId, 'prev');
            } else {
                prevBtn.disabled = true;
                prevBtn.onclick = null;
            }
        }

        if (nextBtn) {
            if (nextPost) {
                nextBtn.disabled = false;
                nextBtn.onclick = () => handlePrevNextPost(currentPostId, 'next');
            } else {
                nextBtn.disabled = true;
                nextBtn.onclick = null;
            }
        }
    } catch (error) {
        console.error('Error updating prev/next buttons:', error);
    }
}

// --- 이미지 리사이즈 설정 ---
function setupImageResize() {
    if (!editor) return;
    
    setTimeout(() => {
        applyImageResizeToAllImages();
    }, 500); // 초기 설정
    
    editor.on('change', () => {
        setTimeout(() => {
            applyImageResizeToAllImages();
        }, 100); // 내용 변경 시
    });
}

// --- 모든 이미지에 리사이즈 적용 ---
function applyImageResizeToAllImages() {
    const editorElement = document.querySelector('.toastui-editor-contents');
    if (!editorElement) return;
    
    const images = editorElement.querySelectorAll('img');
    images.forEach((img, index) => {
        // 기존 이벤트 리스너 제거
        img.removeEventListener('mouseenter', handleImageMouseEnter);
        img.removeEventListener('mouseleave', handleImageMouseLeave);
        img.removeEventListener('click', handleImageClick);
        
        // 스타일 설정
        img.style.cursor = 'pointer';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.transition = 'all 0.3s ease';
        img.style.border = '2px dashed transparent';
        img.style.position = 'relative';
        img.style.display = 'inline-block';
        
        // 이벤트 리스너 추가
        img.addEventListener('mouseenter', handleImageMouseEnter);
        img.addEventListener('mouseleave', handleImageMouseLeave);
        img.addEventListener('click', handleImageClick);
    });
}

// --- 이미지 마우스 이벤트 핸들러 ---
function handleImageMouseEnter() {
    this.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    this.style.border = '2px dashed #3b82f6';
}

function handleImageMouseLeave() {
    this.style.boxShadow = '';
    this.style.border = '2px dashed transparent';
}

function handleImageClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 다른 이미지들의 리사이즈 모드 해제
    const allImages = document.querySelectorAll('.toastui-editor-contents img');
    allImages.forEach(img => {
        img.contentEditable = 'false';
        img.style.cursor = 'pointer';
        img.style.border = '2px dashed transparent';
    });
    
    // 클릭된 이미지 리사이즈 모드 활성화
    this.contentEditable = 'true';
    this.style.cursor = 'nw-resize';
    this.style.border = '2px solid #3b82f6';
    this.style.resize = 'both';
    this.style.overflow = 'auto';
    this.style.minWidth = '50px';
    this.style.minHeight = '50px';
    
    // 다른 곳 클릭 시 리사이즈 모드 해제
    document.addEventListener('click', function removeResize() {
        allImages.forEach(img => {
            img.contentEditable = 'false';
            img.style.cursor = 'pointer';
            img.style.border = '2px dashed transparent';
            img.style.resize = '';
            img.style.overflow = '';
            img.style.minWidth = '';
            img.style.minHeight = '';
        });
        document.removeEventListener('click', removeResize);
    });
}

// --- 이미지 업로드 처리 ---
async function handleImageUpload(file) {
    if (isUploading) return; // 업로드 중이면 무시
    
    isUploading = true;
    
    try {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabaseClient.storage
            .from('images')
            .upload(fileName, file);

        if (error) {
            console.error('Image upload error:', error);
            return null;
        }

        const { data: { publicUrl } } = supabaseClient.storage
            .from('images')
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.error('Image upload exception:', error);
        return null;
    } finally {
        isUploading = false;
    }
}

// --- 페이지 로드 시 초기화 ---
window.onload = function() {
    // Supabase 클라이언트 재초기화
    if (typeof supabase !== 'undefined' && !supabaseClient) {
        supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client initialized');
    }
    
    renderQuickFilterButtons();
    showView('list');
    
    // HTML onclick 속성을 사용하므로, 별도의 이벤트 리스너는 필요 없습니다.
    document.getElementById('editor-form').addEventListener('submit', (e) => e.preventDefault());
    
    // 파일 업로드 설정을 약간의 지연 후에 실행
    setTimeout(() => {
        setupFileUpload();
    }, 100);
}; 