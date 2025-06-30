const clientId = '5aab9ba401374e7292e3ee291e498067';
const redirectUri = 'https://melodybee.github.io/EarlyWrapped/EarlyWrapped.html';
const scopes = ['user-top-read', 'user-read-recently-played'];

function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
}

function base64encode(str) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64encode(digest);
}

async function redirectToSpotifyLogin() {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const authUrl = `https://accounts.spotify.com/authorize?response_type=code` +
        `&client_id=${clientId}` +
        `&scope=${encodeURIComponent(scopes.join(' '))}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}`;

    window.location.href = authUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', redirectToSpotifyLogin);
    }
});

async function fetchAccessToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const data = await res.json();
    return data.access_token;
}

window.addEventListener('load', async () => {
    const code = new URLSearchParams(window.location.search).get('code');
    let token = localStorage.getItem('spotify_token');

    if (code && !token) {
        token = await fetchAccessToken(code);
        if (token) {
            localStorage.setItem('spotify_token', token);
            window.history.replaceState({}, document.title, redirectUri);
        }
    }

    if (token) {
        getTopTracks(token);
        getTopArtists(token);
        getListeningStats(token);
        getUniqueArtists(token);

        const downloadBtn = document.getElementById('downloadWrapped');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const target = document.getElementById('mainWindow');
                html2canvas(target)
                    .then((canvas) => {
                        const link = document.createElement('a');
                        link.download = 'early-wrapped.png';
                        link.href = canvas.toDataURL();
                        link.click();
                    })
                    .catch(err => console.error('Download error:', err));
            });
        }
    }
});

function getTopTracks(token) {
    fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=long_term', {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('topTracks');
            if (!list) return;
            data.items.forEach((track, i) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `<span class="track-index">${i + 1}.</span> 
                                <span class="track-name">${track.name}</span> — 
                                <span class="track-artist-name">${track.artists[0].name}</span>`;
                list.appendChild(li);
            });
        })
        .catch(err => console.error('Top Tracks Error:', err));
}

function getTopArtists(token) {
    fetch('https://api.spotify.com/v1/me/top/artists?limit=5&time_range=long_term', {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('topArtist');
            if (!list) return;
            data.items.forEach((artist, i) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `<span class="track-index">${i + 1}.</span> <span class="artist-name">${artist.name}</span>`;
                list.appendChild(li);
            });

            const genre = data.items.find(a => a.genres?.length)?.genres[0] || 'Unknown';
            const genreElem = document.getElementById('topGenre');
            if (genreElem) genreElem.textContent = genre;
        })
        .catch(err => console.error('Top Artists Error:', err));
}

function getListeningStats(token) {
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            const totalMs = data.items.reduce((acc, item) => acc + item.track.duration_ms, 0);
            const totalMin = Math.round(totalMs / 60000);
            const statElem = document.getElementById('totalMinutes');
            if (statElem) statElem.textContent = totalMin;
        })
        .catch(err => console.error('Listening Stats Error:', err));
}

function getUniqueArtists(token) {
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(data => {
            const ids = data.items.map(item => item.track.artists[0].id);
            const uniqueCount = new Set(ids).size;
            const uniqueElem = document.getElementById('uniqueArtists');
            if (uniqueElem) uniqueElem.textContent = uniqueCount;
        })
        .catch(err => console.error('Unique Artists Error:', err));
}
