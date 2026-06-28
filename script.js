import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, child, set, push, onValue, query, orderByChild, limitToFirst } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://meme-match-a682a-default-rtdb.firebaseio.com/"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const soundClick = new Audio('heeee.mp3');
const soundMatch = new Audio('heeheeeee.mp3');
const soundWrong = new Audio('aoww.mp3');

const maxPhases = 3;
const memesPerPhase = 8; 
let allMemes = [];       
let currentPhase = 1;
let wrongCount = 0;
let maxWrong = 32;       
let totalWrongMoves = 0;
let matchedPairs = 0;

let flippedCards = [];
let lockBoard = false;
let currentUser = null;

const homePanel = document.getElementById('home-panel');
const gameUi = document.getElementById('game-ui');
const board = document.getElementById('game-board');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const phaseDisplay = document.getElementById('phase-display');
const wrongDisplay = document.getElementById('wrong-display');
const welcomeText = document.getElementById('welcome-text');
const scoreList = document.getElementById('score-list');

function checkLogin() {
    const savedUser = localStorage.getItem('memeUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showHome();
    } else {
        showLoginPopup();
    }
}

function showLoginPopup() {
    Swal.fire({
        title: 'เข้าสู่ระบบ',
        html: `
            <input type="text" id="login-user" class="swal2-input" placeholder="Username">
            <input type="password" id="login-pass" class="swal2-input" placeholder="Password">
            <div style="margin-top: 15px;">
                <a href="#" id="link-register" style="color: #feffff; margin-right: 15px;">สมัครสมาชิกใหม่</a>
                <a href="#" id="link-reset" style="color: #a80404;">ลืมรหัสผ่าน?</a>
            </div>
        `,
        confirmButtonText: 'ล็อคอิน',
        confirmButtonColor: '#00c3ff',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            document.getElementById('link-register').addEventListener('click', (e) => { e.preventDefault(); showRegisterPopup(); });
            document.getElementById('link-reset').addEventListener('click', (e) => { e.preventDefault(); showResetPopup(); });
        },
        preConfirm: async () => {
            const user = document.getElementById('login-user').value.trim();
            const pass = document.getElementById('login-pass').value.trim();
            if (!user || !pass) return Swal.showValidationMessage('กรอกให้ครบสิลูกพี่!');
            
            const snapshot = await get(child(ref(db), `users/${user}`));
            if (snapshot.exists() && snapshot.val().password === pass) {
                return { username: user, displayName: snapshot.val().displayName };
            } else {
                Swal.showValidationMessage('Username หรือ Password ผิดจั้ฟ!');
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser = result.value;
            localStorage.setItem('memeUser', JSON.stringify(currentUser));
            Swal.fire({ icon: 'success', title: 'เข้าสู่ระบบสำเร็จ!!!', showConfirmButton: false, timer: 1000 });
            showHome();
        }
    });
}

function showRegisterPopup() {
    Swal.fire({
        title: 'สมัครสมาชิก',
        html: `
            <input type="text" id="reg-user" class="swal2-input" placeholder="Username (ใช้ล็อคอิน)">
            <input type="password" id="reg-pass" class="swal2-input" placeholder="Password">
            <input type="text" id="reg-display" class="swal2-input" placeholder="ชื่อในเกม (Display Name)">
        `,
        showCancelButton: true,
        confirmButtonText: 'สมัคร',
        cancelButtonText: 'กลับ',
        preConfirm: async () => {
            const user = document.getElementById('reg-user').value.trim();
            const pass = document.getElementById('reg-pass').value.trim();
            const display = document.getElementById('reg-display').value.trim();
            if (!user || !pass || !display) return Swal.showValidationMessage('กรอกให้ครบทุกช่อง i here!');
            
            const snapshot = await get(child(ref(db), `users/${user}`));
            if (snapshot.exists()) return Swal.showValidationMessage('Username นี้มีคนใช้แล้ว i sus!');
            
            await set(ref(db, `users/${user}`), { password: pass, displayName: display });
            return true;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire('สำเร็จ!', 'สมัครเสร็จเเล้ว กลับไปล็อคอินซะ!!', 'success').then(showLoginPopup);
        } else {
            showLoginPopup();
        }
    });
}

function showResetPopup() {
    Swal.fire({
        title: 'รีเซ็ตรหัสผ่าน',
        input: 'text',
        inputPlaceholder: 'ใส่ Username มา',
        showCancelButton: true,
        confirmButtonText: 'ตรวจสอบ',
        preConfirm: async (user) => {
            if (!user) return Swal.showValidationMessage('กรอก Username ด้วย i sus!');
            const snapshot = await get(child(ref(db), `users/${user}`));
            if (!snapshot.exists()) return Swal.showValidationMessage('ไม่พบ Username นี้ในระบบ!');
            return user;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'ตั้งรหัสผ่านใหม่',
                input: 'password',
                inputPlaceholder: 'รหัสผ่านใหม่',
                confirmButtonText: 'บันทึก',
                preConfirm: async (newPass) => {
                    if (!newPass) return Swal.showValidationMessage('กรอกรหัสด้วย i sus!');
                    const userRef = ref(db, `users/${result.value}/password`);
                    await set(userRef, newPass);
                }
            }).then((res) => {
                if (res.isConfirmed) Swal.fire('เรียบร้อย!', 'เปลี่ยนรหัสผ่านแล้ว', 'success').then(showLoginPopup);
            });
        } else {
            showLoginPopup();
        }
    });
}

function showHome() {
    gameUi.style.display = 'none';
    leaderboardPanel.style.display = 'none';
    homePanel.style.display = 'block';
    welcomeText.innerText = `ยินดีต้อนรับ, ${currentUser.displayName}`;
}

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('memeUser');
    currentUser = null;
    homePanel.style.display = 'none';
    showLoginPopup();
});

document.getElementById('btn-play').addEventListener('click', () => {
    homePanel.style.display = 'none';
    gameUi.style.display = 'block';
    startNewGame(); 
});

document.getElementById('btn-leaderboard').addEventListener('click', () => showDataPanel('leaderboard'));
document.getElementById('btn-stats').addEventListener('click', () => showDataPanel('history'));
document.getElementById('btn-back-home').addEventListener('click', showHome);
document.getElementById('btn-back-home-2').addEventListener('click', showHome);

async function startNewGame() {
    currentPhase = 1;
    totalWrongMoves = 0;
    updatePhaseWrongLimit();

    board.innerHTML = '<h2 style="grid-column: span 4; text-align: center;">กำลังโหลก...</h2>';

    try {
        const response = await fetch('https://meme-api.com/gimme/40');
        const result = await response.json();
        
        if (result.memes) {
            let fetchedMemes = result.memes.map(meme => meme.url);
            while (fetchedMemes.length < maxPhases * memesPerPhase) {
                fetchedMemes = [...fetchedMemes, ...fetchedMemes];
            }
            allMemes = fetchedMemes;
            loadPhase();
        }
    } catch (error) {
        Swal.fire('Error', 'เน็ตมึงกากอะลุกพี่ โหลกมีมไม่ขึ้นโว้ยย ไปเติมเน็ต!!!!', 'error');
        showHome();
    }
}

function updatePhaseWrongLimit() {
    wrongCount = 0;
    maxWrong = 32 - (currentPhase - 1); 
    updateStats();
}

function loadPhase() {
    board.innerHTML = '';
    matchedPairs = 0;
    flippedCards = [];
    lockBoard = false;
    updateStats();

    const startIndex = (currentPhase - 1) * memesPerPhase;
    const phaseMemes = allMemes.slice(startIndex, startIndex + memesPerPhase);

    let gameCards = [...phaseMemes, ...phaseMemes];
    gameCards.sort(() => 0.5 - Math.random());

    gameCards.forEach((imgUrl) => {
        const card = document.createElement('div');
        card.classList.add('card', 'glass-panel');
        card.dataset.name = imgUrl;

        const img = document.createElement('img');
        img.src = imgUrl;

        card.appendChild(img);
        card.addEventListener('click', () => flipCard(card));
        board.appendChild(card);
    });
}

function flipCard(card) {
    if (lockBoard) return;
    if (card === flippedCards[0]) return;
    if (card.classList.contains('matched')) return;

    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 1) {
        soundClick.currentTime = 0;
        soundClick.play();
    } else if (flippedCards.length === 2) {
        checkForMatch();
    }
}

function checkForMatch() {
    lockBoard = true;
    let isMatch = flippedCards[0].dataset.name === flippedCards[1].dataset.name;

    if (isMatch) {
        soundMatch.currentTime = 0;
        soundMatch.play();
        flippedCards[0].classList.add('matched');
        flippedCards[1].classList.add('matched');
        matchedPairs++;
        resetBoard();

        if (matchedPairs === memesPerPhase) {
            setTimeout(nextPhase, 1000);
        }
    } else {
        soundWrong.currentTime = 0;
        soundWrong.play();
        wrongCount++;
        totalWrongMoves++;
        updateStats();

        if (wrongCount >= maxWrong) {
            setTimeout(gameOver, 500);
            return;
        }

        setTimeout(() => {
            flippedCards[0].classList.remove('flipped');
            flippedCards[1].classList.remove('flipped');
            resetBoard();
        }, 1000);
    }
}

function resetBoard() {
    [flippedCards, lockBoard] = [[], false];
}

function updateStats() {
    phaseDisplay.innerText = `Phase: ${currentPhase}/${maxPhases}`;
    wrongDisplay.innerText = `Wrong: ${wrongCount}/${maxWrong}`;
}

function nextPhase() {
    if (currentPhase === maxPhases) {
        gameWin();
    } else {
        currentPhase++;
        updatePhaseWrongLimit();
        loadPhase();
    }
}

function gameOver() {
    Swal.fire('อ๊าวววส์!', 'เริ่มไหม่นะครับคนเก่งงงงง', 'error').then(showHome);
}

function gameWin() {
    Swal.fire('เหยดดเข้!!', `ตึงเสยยย 3 เฟส\nผิดรวม ${totalWrongMoves} ครั้ง`, 'success').then(() => {
        push(ref(db, 'leaderboard'), {
            name: currentUser.displayName,
            wrongTotal: totalWrongMoves,
            date: new Date().toLocaleDateString()
        });
        push(ref(db, `users/${currentUser.username}/history`), {
            wrongTotal: totalWrongMoves,
            date: new Date().toLocaleDateString()
        });
        showHome();
    });
}

function showDataPanel(type) {
    homePanel.style.display = 'none';
    gameUi.style.display = 'none';
    leaderboardPanel.style.display = 'block';
    scoreList.innerHTML = '<li>กำลังโหลดข้อมูล...</li>';
    
    if (type === 'leaderboard') {
        document.getElementById('leaderboard-title').innerText = 'Top 20';
        const topQuery = query(ref(db, 'leaderboard'), orderByChild('wrongTotal'), limitToFirst(20));
        onValue(topQuery, (snapshot) => {
            scoreList.innerHTML = '';
            if (snapshot.exists()) {
                let rank = 1;
                snapshot.forEach((child) => {
                    const data = child.val();
                    scoreList.innerHTML += `<li><span>#${rank} ${data.name}</span> <span>ผิด ${data.wrongTotal} ครั้ง</span></li>`;
                    rank++;
                });
            } else {
                scoreList.innerHTML = '<li>ยังไม่มีใครจั้ฟฟ</li>';
            }
        });
    } else if (type === 'history') {
        document.getElementById('leaderboard-title').innerText = 'ประวัติการเล่น';
        onValue(ref(db, `users/${currentUser.username}/history`), (snapshot) => {
            scoreList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const data = child.val();
                    scoreList.innerHTML += `<li><span>วันที่ ${data.date}</span> <span>ผิด ${data.wrongTotal} ครั้ง</span></li>`;
                });
            } else {
                scoreList.innerHTML = '<li>มึงไปเล่นให้จบเกมก่อนมั้ยครับท่าน กุจะเอาสถิติไหนมาเเสดงให้มึงล่ะ!!</li>';
            }
        });
    }
}

checkLogin();