// Felinora (liquid glass) — https://github.com/realFelinora/felinora-spicetify
// Çalan şarkının bulanık kapağı arka planda durur, paneller onun üstünde buzlu cam.
(function felinora() {
    const root = document.documentElement
    // Spotify yeni açılınca Player bir süre hazır olmuyor
    if (!document.body || !window.Spicetify || !Spicetify.Player || !Spicetify.Player.addEventListener) { setTimeout(felinora, 300); return }
    root.classList.add("fl-glass")

    // ---- arka plan: kapak, iki katman arasında yumuşak geçiş ----
    const wrap = document.createElement("div"); wrap.id = "fl-bg"
    const a = document.createElement("div"), b = document.createElement("div")
    a.className = b.className = "fl-bg-layer"
    wrap.append(a, b); document.body.prepend(wrap)
    let front = a, lastUrl = ""
    const coverUrl = () => {
        const m = Spicetify.Player.data && Spicetify.Player.data.item && Spicetify.Player.data.item.metadata
        const u = m && (m.image_xlarge_url || m.image_large_url || m.image_url)
        return u ? u.replace("spotify:image:", "https://i.scdn.co/image/") : ""
    }
    const setBg = () => {
        const u = coverUrl(); if (!u || u === lastUrl) return
        lastUrl = u
        const img = new Image()
        img.onload = () => {
            const back = front === a ? b : a
            back.style.backgroundImage = 'url("' + u + '")'
            back.classList.add("on"); front.classList.remove("on"); front = back
        }
        img.src = u
    }
    setBg()
    const bgRetry = setInterval(() => { if (lastUrl) clearInterval(bgRetry); else setBg() }, 1000)

    Spicetify.Player.addEventListener("songchange", () => {
        setBg()
        root.classList.remove("fl-pulse"); void root.offsetWidth; root.classList.add("fl-pulse")
    })
    const sync = () => { try { root.classList.toggle("fl-playing", !!Spicetify.Player.isPlaying()) } catch (e) {} }
    Spicetify.Player.addEventListener("onplaypause", sync); sync()

    // ---- tıklanan şarkı yumuşakça listenin ortasına kayar ----
    const scroller = el => {
        for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
            const oy = getComputedStyle(e).overflowY
            if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 4) return e
        }
        return null
    }
    // Spotify satırları yeniden kullandığı için satır her karede sıra numarasıyla yeniden bulunur
    let scrollJob = 0
    function centerRow(row) {
        const sc = scroller(row); if (!sc) return
        const holder = row.closest('[role="row"]'), idx = holder && holder.getAttribute("aria-rowindex")
        const find = () => (idx && sc.querySelector('[role="row"][aria-rowindex="' + idx + '"]')) || (row.isConnected ? row : null)
        const job = ++scrollJob, t0 = performance.now()
        let last = t0
        requestAnimationFrame(function step(now) {
            if (job !== scrollJob) return
            const el = find(); if (!el) return
            const r = sc.getBoundingClientRect(), bb = el.getBoundingClientRect()
            const d = (bb.top + bb.height / 2) - (r.top + r.height / 2)
            const dt = Math.min(64, now - last); last = now
            if (Math.abs(d) < 1 || now - t0 > 1200) return
            const s = d * (1 - Math.exp(-dt / 95))
            sc.scrollTop += Math.abs(s) < 1 ? Math.sign(d) : s
            requestAnimationFrame(step)
        })
    }
    // kullanıcı kendisi kaydırırsa hemen bırak
    for (const ev of ["wheel", "touchstart", "keydown"]) document.addEventListener(ev, () => { scrollJob++ }, { capture: true, passive: true })
    document.addEventListener("click", e => {
        const row = e.target.closest && e.target.closest("#main-view .main-trackList-trackListRow")
        if (row && !e.target.closest('button[aria-haspopup], button[aria-checked], [data-testid="more-button"]')) centerRow(row)
    }, true)

    // ---- çark etkisi için liste düzeltmesi ----
    // Spotify listeyi "transform: translateY" ile yerleştiriyor; kaydırmaya bağlı CSS animasyonu (view())
    // dönüşümleri görmediği için satırlar yanlış yerde sanılıyordu. Aynı kaydırmayı "top" ile yap.
    const fixList = el => {
        const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform)
        if (!m) return
        el.style.setProperty("position", "relative")
        el.style.setProperty("top", m[1] + "px")
        el.style.setProperty("transform", "none")
    }
    const watched = new WeakSet()
    setInterval(() => {
        document.querySelectorAll('#main-view [role="grid"] [role="presentation"][style*="translateY"], #main-view [role="grid"] [role="presentation"][style*="top"]').forEach(el => {
            if (watched.has(el)) return
            watched.add(el); fixList(el)
            new MutationObserver(() => fixList(el)).observe(el, { attributes: true, attributeFilter: ["style"] })
        })
    }, 300)

    // ---- şarkı sözlerinde çalan satırı işaretle ----
    // Spotify sınıf adlarını karıştırıyor: çalan satır, sınıfı listede yalnızca bir kez geçen satırdır
    const LYR = '[style*="--lyrics-color-active"]'
    let activeTok = null
    function markBox(box) {
        const lines = [...box.querySelectorAll('div[dir="auto"]')]
        const freq = {}
        lines.forEach(l => l.classList.forEach(c => { if (!c.startsWith("fl-")) freq[c] = (freq[c] || 0) + 1 }))
        const ones = Object.keys(freq).filter(c => freq[c] === 1)
        if (!activeTok && ones.length === 1 && Object.keys(freq).length >= 3) activeTok = ones[0]
        lines.forEach(l => l.classList.toggle("fl-lyric-active", !!activeTok && l.classList.contains(activeTok)))
    }
    // tüm sayfayı izlemek Spotify'ı yavaşlatıyordu: yalnızca sözler ekrandayken saniyede 4 kez bak
    setInterval(() => {
        const boxes = [...document.querySelectorAll(LYR)].filter(b => !b.closest('[class*="Root__right-sidebar"]'))
        if (boxes.some(b => { const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.height > 0 })) boxes.forEach(markBox)
    }, 250)
})()
