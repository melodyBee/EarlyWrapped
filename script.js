const clientId = '5aab9ba401374e7292e3ee291e498067'
const redirectUri = 'https://melodybee.github.io/EarlyWrapped/EarlyWrapped/'
console.log('Auth URL:', authUrl)

const scopes = ['user-top-read', 'user-read-recently-played']

function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
}

function base64encode(str) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

async function generateCodeChallenge(codeVerifier) {
    try {
        const data = new TextEncoder().encode(codeVerifier)
        const digest = await crypto.subtle.digest('SHA-256', data)
        return base64encode(digest)
    } catch (err) {
        console.error('Error generating code challenge:', err)
    }
}

async function redirectToSpotifyLogin() {
    try {
        const codeVerifier = generateRandomString(64)
        const codeChallenge = await generateCodeChallenge(codeVerifier)
        localStorage.setItem('spotify_code_verifier', codeVerifier)

        const authUrl =
            'https://accounts.spotify.com/authorize' +
            '?response_type=code' +
            `&client_id=${clientId}` +
            `&scope=${scopes.join('%20')}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&code_challenge_method=S256&code_challenge=${codeChallenge}`

        window.location.href = authUrl
    } catch (err) {
        console.error('Error during redirect to Spotify login:', err)
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname
    if (path.endsWith('/') || path.includes('index.html')) {
        const loginBtn = document.getElementById('loginBtn')
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                try {
                    redirectToSpotifyLogin()
                } catch (err) {
                    console.error('Login button click error:', err)
                }
            })
        }
    }
})

async function fetchAccessToken(code) {
    try {
        const codeVerifier = localStorage.getItem('spotify_code_verifier')
        const body = new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        })
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        })
        const data = await res.json()
        return data.access_token
    } catch (err) {
        console.error('Error fetching access token:', err)
    }
}

window.addEventListener('load', async () => {
    try {
        if (window.location.pathname.includes('EarlyWrapped')) {
            const params = new URLSearchParams(window.location.search)
            const code = params.get('code')

            if (code) {
                try {
                    const token = await fetchAccessToken(code)
                    localStorage.setItem('spotify_token', token)
                    window.location.href = redirectUri
                } catch (error) {
                    console.error('Error exchanging code:', error)
                }
            } else {
                const token = localStorage.getItem('spotify_token')
                if (!token) {
                    console.warn('No token found, returning to login.')
                    window.location.href = 'https://melodybee.github.io/EarlyWrapped/'
                    return
                }
                document.addEventListener('DOMContentLoaded', () => {
                    getTopTracks(token)
                    getTopArtists(token)
                    getListeningStats(token)
                    getUniqueArtists(token)
                })

                const downloadBtn = document.getElementById('downloadWrapped')
                if (downloadBtn) {
                    try {
                        downloadBtn.addEventListener('click', () => {
                            const target = document.getElementById('mainWindow')
                            html2canvas(target)
                                .then((canvas) => {
                                    const link = document.createElement('a')
                                    link.download = 'early-wrapped.png'
                                    link.href = canvas.toDataURL()
                                    link.click()
                                })
                                .catch((err) => console.error('Download canvas error:', err))
                        })
                    } catch (err) {
                        console.error('Error binding download:', err)
                    }
                }
            }
        }
    } catch (err) {
        console.error('Window load error:', err)
    }
})

function getTopTracks(token) {
    fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=long_term', {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((res) => res.json())
        .then((data) => {
            console.log('Top Tracks API:', data)
            const list = document.getElementById('topTracks')
            if (!list) return
            data.items.forEach((track, index) => {
                const li = document.createElement('li')
                li.className = 'list-group-item'
                li.innerHTML = `
  <span class="track-index">${index + 1}.</span> 
  <span class="track-name">${track.name}</span> — 
  <span class="track-artist-name">${track.artists[0].name}</span>
`
                list.appendChild(li)
            })
        })
        .catch((err) => console.error('Top Tracks Error:', err))
}

function getTopArtists(token) {
    fetch('https://api.spotify.com/v1/me/top/artists?limit=5&time_range=long_term', {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((res) => res.json())
        .then((data) => {
            console.log('Top Artists API:', data)
            const list = document.getElementById('topArtist')
            if (!list) return
            data.items.forEach((artist, index) => {
                const li = document.createElement('li')
                li.className = 'list-group-item'
                li.innerHTML = `<span class="track-index">${
                    index + 1
                }.</span> <span class="artist-name">${artist.name}</span>`
                list.appendChild(li)
            })

            const artistWithGenre = data.items.find(
                (artist) => artist.genres && artist.genres.length > 0
            )
            const topGenre = document.getElementById('topGenre')
            if (topGenre) {
                topGenre.textContent = artistWithGenre ? artistWithGenre.genres[0] : 'Unknown'
            }
        })
        .catch((err) => console.error('Top Artists Error:', err))
}

function getListeningStats(token) {
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((res) => res.json())
        .then((data) => {
            console.log('Listening Stats API:', data)
            let totalMs = 0
            data.items.forEach((item) => {
                totalMs += item.track.duration_ms
            })
            const totalMinutes = Math.round(totalMs / 60000)
            const totalMinutesElem = document.getElementById('totalMinutes')
            if (totalMinutesElem) {
                totalMinutesElem.textContent = totalMinutes
            }
        })
        .catch((err) => console.error('Listening Stats Error:', err))
}

function getUniqueArtists(token) {
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
    })
        .then((res) => res.json())
        .then((data) => {
            console.log('Unique Artists API:', data)
            const artistIDs = data.items.map((item) => item.track.artists[0].id)
            const uniqueArtists = new Set(artistIDs)
            const uniqueElem = document.getElementById('uniqueArtists')
            if (uniqueElem) {
                uniqueElem.textContent = uniqueArtists.size
            }
        })
        .catch((err) => console.error('Unique Artists Error:', err))
}
