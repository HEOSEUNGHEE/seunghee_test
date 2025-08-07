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
let uploadedFiles = [];
let isUploading = false;
let editor = null; // CKEditor 인스턴스

// --- DOM 요소 ---
const views = {
    list: document.getElementById('list-view'),
    detail: document.getElementById('detail-view'),
    editor: document.getElementById('editor-view'),
};
const breadcrumb = document.getElementById('breadcrumb');
const tabsContainer = document.getElementById('tabs-container');
const tabs = {
    list: document.getElementById('tab-list'),
    manage: document.getElementById('tab-manage'),
};

// --- 함수 ---

/** 날짜 포맷팅 함수 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16).replace('T', ' ');
}

/** 뷰 전환 함수 */
async function showView(viewName, postId = null) {
    currentView = viewName;
    currentPostId = postId;
    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    if (viewName === 'list' || viewName === 'detail') {
        tabsContainer.classList.add('hidden');
        if (viewName === 'list') {
            breadcrumb.textContent = 'Home > 공지사항';
            await renderListView();
        } else {
            breadcrumb.textContent = 'Home > 공지사항 > 상세';
            await renderDetailView(postId);
        }
    } else if (viewName === 'editor') {
        tabsContainer.classList.remove('hidden');
        breadcrumb.textContent = `Home > 공지사항 > ${postId ? '수정' : '작성'}`;
        tabs.list.classList.add('tab-inactive');
        tabs.manage.classList.remove('hidden');
        tabs.manage.classList.add('tab-active');
        await renderEditorView(postId);
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
                attachmentText = attachmentCount > 1 ? `${lastFile.name} 외 ${attachmentCount - 1}개` : lastFile.name;
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
    document.getElementById('detail-title').textContent = '로딩 중...';
    document.getElementById('detail-body').innerHTML = '<p class="text-center py-10">내용을 불러오는 중입니다...</p>';
    document.getElementById('detail-category').textContent = '';
    document.getElementById('detail-date').textContent = '';
    document.getElementById('detail-important-tag').classList.add('hidden');
    document.getElementById('detail-attachment-container').innerHTML = '';
    document.getElementById('prev-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    
    const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
    if (error || !post) {
        console.error('Error fetching post:', error);
        alert('게시글을 불러오지 못했습니다.');
        return showView('list');
    }
    document.getElementById('detail-category').textContent = post.category;
    document.getElementById('detail-date').textContent = formatDate(post.created_at);
    document.getElementById('detail-title').textContent = post.title;
    document.getElementById('detail-body').innerHTML = post.content; // Toast UI는 HTML로 저장되므로 정규화 불필요
    document.getElementById('detail-important-tag').classList.toggle('hidden', !post.is_important);
    renderAttachments(post.attachments || []);
    document.getElementById('edit-btn').onclick = () => showView('editor', postId);
    document.getElementById('delete-btn').onclick = () => handleDeletePost(postId);
    await updatePrevNextButtons(post.created_at, post.id);
}

/** 첨부파일 렌더링 */
function renderAttachments(attachments) {
    const container = document.getElementById('detail-attachment-container');
    container.classList.toggle('hidden', !attachments || attachments.length === 0);
    if (!attachments || attachments.length === 0) return;
    const attachmentList = attachments.map(file => `
        <button onclick="downloadFile('${file.url}', '${file.name}')" class="flex items-center gap-2 p-2 bg-gray-50 rounded border hover:bg-gray-100 w-full text-left">
            <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            <span class="text-sm text-gray-700 truncate" title="${file.name}">${file.name}</span>
        </button>
    `).join('');
    container.innerHTML = `<h4 class="text-sm font-semibold text-gray-700 mb-2">첨부파일 (${attachments.length}개)</h4><div class="space-y-2">${attachmentList}</div>`;
}

/** 파일 다운로드 함수 */
async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok.');
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = filename;
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
async function updatePrevNextButtons(currentPostDate, currentPostId) {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // 이전 글 조회 (더 오래된 글) - ID가 더 작은 글
    const { data: prevPost } = await supabaseClient.from('posts').select('id').lt('id', currentPostId).order('id', { ascending: false }).limit(1).maybeSingle();
    
    // 다음 글 조회 (더 최근 글) - ID가 더 큰 글
    const { data: nextPost } = await supabaseClient.from('posts').select('id').gt('id', currentPostId).order('id', { ascending: true }).limit(1).maybeSingle();
    
    // 이전 글 버튼 처리 (더 오래된 글)
    if (prevPost) {
        prevBtn.style.display = 'inline-block';
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
        prevBtn.style.backgroundColor = ''; // 기본 색상 사용
        prevBtn.onmouseover = null;
        prevBtn.onmouseout = null;
        prevBtn.onclick = () => showView('detail', prevPost.id);
    } else {
        prevBtn.style.display = 'none'; // 버튼 완전히 숨김
        prevBtn.disabled = true;
        prevBtn.onclick = null;
    }
    
    // 다음 글 버튼 처리 (더 최근 글)
    if (nextPost) {
        nextBtn.style.display = 'inline-block';
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.backgroundColor = ''; // 기본 색상 사용
        nextBtn.onmouseover = null;
        nextBtn.onmouseout = null;
        nextBtn.onclick = () => showView('detail', nextPost.id);
    } else {
        nextBtn.style.display = 'none'; // 버튼 완전히 숨김
        nextBtn.disabled = true;
        nextBtn.onclick = null;
    }
}

/** 작성/수정 뷰 렌더링 (CKEditor) */
async function renderEditorView(postId = null) {
    if (editor) {
        editor.destroy();
        editor = null;
    }
    
    document.getElementById('editor-form').reset();
    document.getElementById('post-id').value = '';
    uploadedFiles = [];
    renderFileList();

    const editorEl = document.getElementById('editor');

    // 이미지 업로드 어댑터 클래스 정의
    class SupabaseUploadAdapter {
        constructor(loader) {
            this.loader = loader;
        }

        async upload() {
            const file = await this.loader.file;
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `images/${fileName}`;

            try {
                const { error: uploadError } = await supabaseClient.storage
                    .from('images')
                    .upload(filePath, file);

                if (uploadError) {
                    throw uploadError;
                }

                const { data } = supabaseClient.storage
                    .from('images')
                    .getPublicUrl(filePath);



                return {
                    default: data.publicUrl
                };
            } catch (error) {
                console.error('Upload failed:', error);
                throw error;
            }
        }

        abort() {
            // 업로드 중단 처리 (필요한 경우 구현)
        }
    }

    // CKEditor 생성
    DecoupledEditor
        .create(document.createElement('div'), {
            extraPlugins: [
                function(editor) {
                    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
                        return new SupabaseUploadAdapter(loader);
                    };
                }
            ],
            toolbar: {
                items: [
                    'heading', '|',
                    'bold', 'italic', 'strikethrough', 'underline', 'link', '|',
                    'bulletedList', 'numberedList', '|',
                    'uploadImage', '|',
                    'blockQuote', '|',
                    'undo', 'redo'
                ],
                shouldNotGroupWhenFull: true
            },
            image: {
                resizeUnit: '%',
                resizeOptions: [
                    {
                        name: 'resizeImage:original',
                        value: null,
                        label: '원본 크기'
                    },
                    {
                        name: 'resizeImage:50',
                        value: '50',
                        label: '50%'
                    },
                    {
                        name: 'resizeImage:75',
                        value: '75',
                        label: '75%'
                    }
                ],
                toolbar: [],
                resizeHandles: true,
                insertImageAsBlock: true,
                styles: ['block', 'inline']
            },
            typing: {
                transformations: {
                    remove: [
                        'blockQuoteAfterEnter'
                    ]
                }
            },
            removePlugins: ['ImageToolbar', 'ImageCaption', 'ImageStyle'],
            heading: {
                options: [
                    { model: 'paragraph', title: '본문', class: 'ck-heading_paragraph' },
                    { model: 'heading1', view: 'h1', title: '제목 1', class: 'ck-heading_heading1' },
                    { model: 'heading2', view: 'h2', title: '제목 2', class: 'ck-heading_heading2' },
                    { model: 'heading3', view: 'h3', title: '제목 3', class: 'ck-heading_heading3' }
                ]
            }
        })
        .then(newEditor => {
            editor = newEditor;
            
            // 기존 내용을 지우고 새로운 구조 생성
            editorEl.innerHTML = '';
            
            // 툴바를 에디터 위에 추가
            const toolbarContainer = document.createElement('div');
            toolbarContainer.classList.add('ck-toolbar-container');
            editorEl.appendChild(toolbarContainer);
            toolbarContainer.appendChild(editor.ui.view.toolbar.element);
            
            // 에디터 본문을 컨테이너에 추가
            const editableContainer = document.createElement('div');
            editableContainer.classList.add('ck-editor__editable-container');
            editorEl.appendChild(editableContainer);
            editableContainer.appendChild(editor.ui.view.editable.element);

            // 에디터 초기 내용 설정 - 빈 단락 추가
            if (!postId) {
                editor.model.change(writer => {
                    const root = editor.model.document.getRoot();
                    const paragraph = writer.createElement('paragraph');
                    writer.append(paragraph, root);
                });
            }

            // 이미지 삽입 시 위아래에 단락 확보
            editor.model.document.on('change:data', () => {
                const changes = editor.model.document.differ.getChanges();
                
                for (const change of changes) {
                    if (change.type === 'insert' && change.name === 'image') {
                        setTimeout(() => {
                            editor.model.change(writer => {
                                const imageElement = change.position.nodeAfter;
                                
                                if (imageElement && imageElement.name === 'image') {
                                    // 이미지 전에 단락이 없으면 추가
                                    const prevElement = imageElement.previousSibling;
                                    if (!prevElement || prevElement.name !== 'paragraph') {
                                        const paragraphBefore = writer.createElement('paragraph');
                                        writer.insert(paragraphBefore, imageElement, 'before');
                                    }
                                    
                                    // 이미지 후에 단락이 없으면 추가
                                    const nextElement = imageElement.nextSibling;
                                    if (!nextElement || nextElement.name !== 'paragraph') {
                                        const paragraphAfter = writer.createElement('paragraph');
                                        writer.insert(paragraphAfter, imageElement, 'after');
                                    }
                                    
                                    // 커서를 이미지 다음 단락으로 이동
                                    const paragraphToFocus = imageElement.nextSibling;
                                    if (paragraphToFocus && paragraphToFocus.name === 'paragraph') {
                                        writer.setSelection(paragraphToFocus, 'in');
                                    }
                                }
                            });
                        }, 100);
                    }
                }
            });
            
            // 에디터 클릭 시 이미지 선택 해제
            editor.editing.view.document.on('click', (evt, data) => {
                setTimeout(() => {
                    const selection = editor.model.document.selection;
                    const selectedElement = selection.getSelectedElement();
                    
                    // 클릭한 대상이 이미지가 아니고, 현재 이미지가 선택된 상태라면
                    if (selectedElement && selectedElement.name === 'image') {
                        const domTarget = data.domTarget;
                        const isImageClick = domTarget.tagName === 'IMG' || domTarget.closest('figure.image');
                        
                        if (!isImageClick) {
                            editor.model.change(writer => {
                                // 문서 끝에 커서 위치
                                const root = editor.model.document.getRoot();
                                const endPosition = writer.createPositionAt(root, root.maxOffset);
                                writer.setSelection(endPosition);
                            });
                        }
                    }
                }, 50);
            });
            
            if (postId) {
                supabaseClient.from('posts').select('*').eq('id', postId).single()
                    .then(({ data: post }) => {
                        if (post) {
                            document.getElementById('post-id').value = post.id;
                            document.getElementById('title').value = post.title;
                            document.getElementById('category').value = post.category || '';
                            document.getElementById('is-fixed').checked = post.is_fixed;
                            document.getElementById('is-important').checked = post.is_important;
                            editor.setData(post.content || '');
                            uploadedFiles = post.attachments || [];
                            renderFileList();
                        }
                    });
            } else {
                document.getElementById('category').value = '';
            }
        })
        .catch(error => {
            console.error('CKEditor 초기화 실패:', error);
            alert('에디터 초기화에 실패했습니다.');
        });
    
    setupFileUpload();
}

/** 파일 업로드 설정 */
function setupFileUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    // 이벤트 리스너 중복 부착 방지
    if (dropZone.dataset.listenersAttached) return;
    dropZone.dataset.listenersAttached = 'true';
    
    dropZone.addEventListener('click', (e) => { 
        if (e.target.tagName !== 'LABEL' && e.target.closest('label') === null) fileInput.click(); 
    });
    dropZone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dropZone.classList.add('border-blue-500', 'bg-blue-50'); 
    });
    dropZone.addEventListener('dragleave', (e) => { 
        e.preventDefault(); 
        dropZone.classList.remove('border-blue-500', 'bg-blue-50'); 
    });
    dropZone.addEventListener('drop', (e) => { 
        e.preventDefault(); 
        dropZone.classList.remove('border-blue-500', 'bg-blue-50'); 
        handleFileUpload(Array.from(e.dataTransfer.files)); 
    });
    fileInput.addEventListener('change', (e) => { 
        handleFileUpload(Array.from(e.target.files)); 
        e.target.value = ''; 
    });
}

/** 파일 업로드 처리 (중복 방지) */
async function handleFileUpload(files) {
    if (isUploading) { alert("파일 업로드 중입니다."); return; }
    isUploading = true;
    const newFiles = files.filter(f => !uploadedFiles.some(uf => uf.name === f.name && uf.size === f.size));
    if (newFiles.length !== files.length) alert("중복된 파일은 제외되었습니다.");
    if (newFiles.length === 0) { isUploading = false; return; }
    try {
        for (const file of newFiles) {
            const fileUrl = await uploadAttachment(file);
            if (fileUrl) uploadedFiles.push({ name: file.name, url: fileUrl, size: file.size, type: file.type });
        }
        renderFileList();
    } catch (error) {
        console.error('File upload error:', error);
        alert(`파일 업로드 중 오류가 발생했습니다.`);
    } finally {
        isUploading = false;
    }
}

/** 첨부파일 업로드 (Supabase 스토리지) */
async function uploadAttachment(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `attachments/${fileName}`;
    const { error } = await supabaseClient.storage.from('images').upload(filePath, file);
    if (error) throw new Error('파일 업로드 실패: ' + error.message);
    const { data: { publicUrl } } = supabaseClient.storage.from('images').getPublicUrl(filePath);
    return publicUrl;
}


/** 파일 목록 렌더링 */
function renderFileList() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = uploadedFiles.map((file, index) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded border mb-2">
            <div class="flex items-center gap-2 overflow-hidden">
                <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                <span class="text-sm text-gray-800 truncate" title="${file.name}">${file.name}</span>
                <span class="text-xs text-gray-500 flex-shrink-0">(${formatFileSize(file.size)})</span>
            </div>
            <button type="button" onclick="removeFile(${index})" class="text-red-500 hover:text-red-700 font-bold text-lg leading-none p-1 ml-2">&times;</button>
        </div>
    `).join('');
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

/** 취소 버튼 핸들러 */
function handleCancel() {
    if (confirm('작성을 취소하시겠습니까? 저장되지 않은 내용은 사라집니다.')) {
        const editorForm = document.getElementById('editor-form');
        const postId = document.getElementById('post-id').value;
        if (editor) {
            editor.setData('');
        }
        editorForm.reset();
        if (postId) {
            showView('detail', postId);
        } else {
            showView('list');
        }
    }
}

/** 저장 버튼 클릭 시 실행될 함수 */
async function savePost() {
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    if (!title || !category) {
        alert('제목과 부가 정보(카테고리)는 필수입니다.');
        return;
    }
    
    const content = editor.getData();
    if (content.replace(/<[^>]+>/g, '').trim() === "" && uploadedFiles.length === 0) {
        alert('내용 또는 첨부파일이 있어야 합니다.');
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
            alert('삭제에 실패했습니다: ' + error.message);
        } else {
            alert('삭제되었습니다.');
            showView('list');
        }
        modal.classList.add('hidden');
    };
}

// --- 페이지 로드 시 초기화 ---
window.onload = function() {
    renderQuickFilterButtons();
    showView('list');
    document.getElementById('editor-form').addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('cancel-delete').addEventListener('click', () => {
        document.getElementById('delete-confirm-modal').classList.add('hidden');
    });
};
