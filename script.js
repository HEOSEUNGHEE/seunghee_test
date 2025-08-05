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

// --- DOM 요소 ---
const views = {
    list: document.getElementById('list-view'),
    detail: document.getElementById('detail-view'),
    editor: document.getElementById('editor-view'),
};
const tabs = {
    list: document.getElementById('tab-list'),
    manage: document.getElementById('tab-manage'),
};

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

    // 에디터 인스턴스가 존재하면 메모리 해제를 위해 제거
    if (editor) {
        editor.destroy();
        editor = null;
    }

    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    tabs.list.classList.remove('tab-active', 'tab-inactive');
    tabs.manage.classList.remove('tab-active', 'tab-inactive');

    if (viewName === 'editor') {
        tabs.list.classList.add('tab-inactive');
        tabs.manage.classList.add('tab-active');
        tabs.manage.classList.remove('hidden');
        await renderEditorView(postId);
    } else {
        tabs.list.classList.add('tab-active');
        tabs.manage.classList.add('tab-inactive');
        tabs.manage.classList.add('hidden');
        if (viewName === 'list') {
            await renderListView();
        } else if (viewName === 'detail' && postId) {
            await renderDetailView(postId);
        }
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
            // 내용에서 HTML 태그 제거하여 미리보기 생성
            const preview = post.content ? post.content.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...' : '';
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="text-center py-3 px-4">${post.is_fixed ? '<span class="text-red-500 font-bold">공지</span>' : postNumber}</td>
                    <td class="py-3 px-4 truncate"><a href="#" class="hover:underline" onclick="event.preventDefault(); showView('detail', ${post.id})">${post.title}</a></td>
                    <td class="text-center py-3 px-4">${post.category}</td>
                    <td class="text-center py-3 px-4">${post.is_important ? '✔️' : ''}</td>
                    <td class="py-3 px-4 text-sm truncate">${preview}</td>
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
    // Toast UI Editor는 HTML을 그대로 저장하므로, innerHTML로 렌더링
    document.getElementById('detail-body').innerHTML = post.content;

    document.getElementById('edit-btn').onclick = () => showView('editor', postId);
    document.getElementById('delete-btn').onclick = () => handleDeletePost(postId);
    document.getElementById('prev-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
}

/** 작성/수정 뷰 렌더링 (Toast UI Editor) */
async function renderEditorView(postId = null) {
    const form = document.getElementById('editor-form');
    form.reset();
    document.getElementById('post-id').value = '';
    
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
        }
    }

    // Toast UI Editor 생성
    editor = new toastui.Editor({
        el: document.querySelector('#editor'),
        height: '400px',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        initialValue: initialContent,
        hooks: {
            // 이미지 업로드 훅
            addImageBlobHook: async (blob, callback) => {
                const publicUrl = await handleImageUpload(blob);
                if (publicUrl) {
                    callback(publicUrl, 'alt text');
                }
            }
        }
    });
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
    // Toast UI Editor는 getHTML() 메서드로 내용을 가져옵니다.
    const content = editor.getHTML();

    if (!title || content.trim() === "") {
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
        content: content, // 에디터 내용을 content 필드에 저장
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
async function handleDeletePost(postId) {
    if (confirm('정말 이 게시글을 삭제하시겠습니까?')) {
        const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
        if (error) {
            console.error('Error deleting post:', error);
            alert('삭제에 실패했습니다: ' + error.message);
        } else {
            alert('삭제되었습니다.');
            showView('list');
        }
    }
}

/** 이미지 업로드 기능 (Supabase 스토리지) */
async function handleImageUpload(file) {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error } = await supabaseClient.storage.from('images').upload(filePath, file);

    if (error) {
        console.error('Error uploading image:', error);
        alert('이미지 업로드에 실패했습니다.');
        return null;
    }

    const { data: { publicUrl } } = supabaseClient.storage.from('images').getPublicUrl(filePath);
    return publicUrl;
}


// --- 페이지 로드 시 초기화 ---
window.onload = function() {
    renderQuickFilterButtons();
    showView('list');
    
    // HTML onclick 속성을 사용하므로, 별도의 이벤트 리스너는 필요 없습니다.
    document.getElementById('editor-form').addEventListener('submit', (e) => e.preventDefault());
};
