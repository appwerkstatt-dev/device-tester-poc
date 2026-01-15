import './style.css'

// ============================================================================
// Tab Navigation
// ============================================================================

function initTabs() {
  const tabs = document.querySelectorAll('.tab')
  const contents = document.querySelectorAll('.tab-content')

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab')

      tabs.forEach(t => t.classList.remove('active'))
      contents.forEach(c => c.classList.remove('active'))

      tab.classList.add('active')
      document.getElementById(tabId!)?.classList.add('active')
    })
  })
}

// ============================================================================
// Camera Module
// ============================================================================

let cameraStream: MediaStream | null = null
let currentFacingMode: 'user' | 'environment' = 'environment'

async function initCamera() {
  const startBtn = document.getElementById('camera-start') as HTMLButtonElement
  const captureBtn = document.getElementById('camera-capture') as HTMLButtonElement
  const switchBtn = document.getElementById('camera-switch') as HTMLButtonElement
  const video = document.getElementById('camera-preview') as HTMLVideoElement
  const canvas = document.getElementById('camera-canvas') as HTMLCanvasElement
  const status = document.getElementById('camera-status')!
  const result = document.getElementById('camera-result')!

  startBtn.addEventListener('click', async () => {
    try {
      status.textContent = 'Status: Starte Kamera...'
      status.className = 'status'

      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop())
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: false
      })

      video.srcObject = cameraStream

      status.textContent = 'Status: Kamera aktiv'
      status.className = 'status success'
      captureBtn.disabled = false
      switchBtn.disabled = false
      startBtn.textContent = 'Kamera stoppen'

      startBtn.onclick = () => {
        cameraStream?.getTracks().forEach(t => t.stop())
        video.srcObject = null
        status.textContent = 'Status: Kamera gestoppt'
        status.className = 'status'
        captureBtn.disabled = true
        switchBtn.disabled = true
        startBtn.textContent = 'Kamera starten'
        startBtn.onclick = null
        initCamera()
      }
    } catch (err) {
      status.textContent = `Status: Fehler - ${(err as Error).message}`
      status.className = 'status error'
    }
  })

  captureBtn.addEventListener('click', () => {
    if (!video.srcObject) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    result.innerHTML = `
      <strong>Foto aufgenommen!</strong><br>
      Aufloesung: ${video.videoWidth} x ${video.videoHeight}<br>
      <img src="${dataUrl}" alt="Captured photo">
    `
  })

  switchBtn.addEventListener('click', async () => {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment'

    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: false
      })
      video.srcObject = cameraStream
      status.textContent = `Status: ${currentFacingMode === 'environment' ? 'Rueckkamera' : 'Frontkamera'} aktiv`
    } catch (err) {
      status.textContent = `Status: Wechsel fehlgeschlagen - ${(err as Error).message}`
      status.className = 'status error'
    }
  })
}

// ============================================================================
// Barcode Scanner Module
// ============================================================================

let scannerStream: MediaStream | null = null
let scannerInterval: number | null = null

async function initScanner() {
  const apiStatus = document.getElementById('barcode-api-status')!
  const status = document.getElementById('scanner-status')!
  const startBtn = document.getElementById('scanner-start') as HTMLButtonElement
  const stopBtn = document.getElementById('scanner-stop') as HTMLButtonElement
  const video = document.getElementById('scanner-preview') as HTMLVideoElement
  const result = document.getElementById('scanner-result')!
  const history = document.getElementById('scanner-history')!

  // Check BarcodeDetector API
  const hasBarcodeAPI = 'BarcodeDetector' in window
  apiStatus.textContent = hasBarcodeAPI ? 'Verfuegbar' : 'Nicht verfuegbar (Fallback: html5-qrcode)'
  apiStatus.className = hasBarcodeAPI ? 'api-supported' : 'api-not-supported'

  let barcodeDetector: BarcodeDetector | null = null
  if (hasBarcodeAPI) {
    const formats = await BarcodeDetector.getSupportedFormats()
    apiStatus.textContent = `Verfuegbar (${formats.length} Formate)`
    barcodeDetector = new BarcodeDetector({ formats })
  }

  const scannedCodes: string[] = []

  startBtn.addEventListener('click', async () => {
    try {
      status.textContent = 'Status: Starte Scanner...'
      status.className = 'status'

      scannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      video.srcObject = scannerStream

      status.textContent = 'Status: Scanner aktiv - halte Barcode in den Rahmen'
      status.className = 'status success'
      startBtn.disabled = true
      stopBtn.disabled = false

      if (barcodeDetector) {
        // Use native BarcodeDetector
        scannerInterval = window.setInterval(async () => {
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return

          try {
            const barcodes = await barcodeDetector!.detect(video)
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue
              if (!scannedCodes.includes(code)) {
                scannedCodes.unshift(code)
                result.textContent = `Erkannt: ${code}\nFormat: ${barcodes[0].format}`
                history.innerHTML = scannedCodes.map(c =>
                  `<div class="history-item">${c}</div>`
                ).join('')

                // Vibrate feedback
                if (navigator.vibrate) {
                  navigator.vibrate(100)
                }
              }
            }
          } catch (e) {
            console.error('Scan error:', e)
          }
        }, 200)
      } else {
        status.textContent = 'Status: BarcodeDetector nicht verfuegbar - benoetige Library'
        status.className = 'status warning'
        result.textContent = 'Native BarcodeDetector API nicht unterstuetzt.\nFuer iOS Safari wird html5-qrcode Library benoetigt.'
      }
    } catch (err) {
      status.textContent = `Status: Fehler - ${(err as Error).message}`
      status.className = 'status error'
    }
  })

  stopBtn.addEventListener('click', () => {
    if (scannerInterval) {
      clearInterval(scannerInterval)
      scannerInterval = null
    }
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop())
      scannerStream = null
    }
    video.srcObject = null
    status.textContent = 'Status: Scanner gestoppt'
    status.className = 'status'
    startBtn.disabled = false
    stopBtn.disabled = true
  })
}

// ============================================================================
// Storage Module
// ============================================================================

const DB_NAME = 'DeviceTesterDB'
const STORE_NAME = 'testData'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function initStorage() {
  const indexeddbStatus = document.getElementById('indexeddb-status')!
  const localstorageStatus = document.getElementById('localstorage-status')!
  const quotaStatus = document.getElementById('storage-quota')!
  const status = document.getElementById('storage-status')!
  const saveBtn = document.getElementById('storage-save') as HTMLButtonElement
  const loadBtn = document.getElementById('storage-load') as HTMLButtonElement
  const clearBtn = document.getElementById('storage-clear') as HTMLButtonElement
  const keyInput = document.getElementById('storage-key') as HTMLInputElement
  const valueInput = document.getElementById('storage-value') as HTMLInputElement
  const result = document.getElementById('storage-result')!

  // Check IndexedDB
  if ('indexedDB' in window) {
    indexeddbStatus.textContent = 'Verfuegbar'
    indexeddbStatus.className = 'api-supported'
  } else {
    indexeddbStatus.textContent = 'Nicht verfuegbar'
    indexeddbStatus.className = 'api-not-supported'
  }

  // Check localStorage
  try {
    localStorage.setItem('test', 'test')
    localStorage.removeItem('test')
    localstorageStatus.textContent = 'Verfuegbar'
    localstorageStatus.className = 'api-supported'
  } catch {
    localstorageStatus.textContent = 'Nicht verfuegbar'
    localstorageStatus.className = 'api-not-supported'
  }

  // Check Storage Quota
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2)
    const quotaMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(0)
    quotaStatus.textContent = `${usedMB} MB / ${quotaMB} MB`
  } else {
    quotaStatus.textContent = 'API nicht verfuegbar'
  }

  saveBtn.addEventListener('click', async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      store.put(valueInput.value, keyInput.value)

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })

      status.textContent = 'Status: Gespeichert!'
      status.className = 'status success'
      result.textContent = `Gespeichert:\nKey: ${keyInput.value}\nValue: ${valueInput.value}`
    } catch (err) {
      status.textContent = `Status: Fehler - ${(err as Error).message}`
      status.className = 'status error'
    }
  })

  loadBtn.addEventListener('click', async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      const request = store.get(keyInput.value)

      const value = await new Promise<string | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      if (value !== undefined) {
        status.textContent = 'Status: Geladen!'
        status.className = 'status success'
        result.textContent = `Geladen:\nKey: ${keyInput.value}\nValue: ${value}`
        valueInput.value = value
      } else {
        status.textContent = 'Status: Key nicht gefunden'
        status.className = 'status warning'
        result.textContent = `Key "${keyInput.value}" nicht gefunden`
      }
    } catch (err) {
      status.textContent = `Status: Fehler - ${(err as Error).message}`
      status.className = 'status error'
    }
  })

  clearBtn.addEventListener('click', async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      store.clear()

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })

      status.textContent = 'Status: Alle Daten geloescht!'
      status.className = 'status success'
      result.textContent = 'IndexedDB geleert'
    } catch (err) {
      status.textContent = `Status: Fehler - ${(err as Error).message}`
      status.className = 'status error'
    }
  })
}

// ============================================================================
// Offline Module
// ============================================================================

async function initOffline() {
  const swStatus = document.getElementById('sw-status')!
  const onlineStatus = document.getElementById('online-status')!
  const cacheStatus = document.getElementById('cache-status')!
  const status = document.getElementById('offline-status')!
  const testBtn = document.getElementById('offline-test') as HTMLButtonElement
  const clearBtn = document.getElementById('cache-clear') as HTMLButtonElement
  const result = document.getElementById('offline-result')!
  const connectionStatus = document.getElementById('connection-status')!

  // Check Service Worker
  if ('serviceWorker' in navigator) {
    swStatus.textContent = 'API verfuegbar'
    swStatus.className = 'api-supported'

    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      swStatus.textContent = `Registriert (${registration.active ? 'aktiv' : 'wartend'})`
    } else {
      swStatus.textContent = 'Nicht registriert'
    }
  } else {
    swStatus.textContent = 'Nicht verfuegbar'
    swStatus.className = 'api-not-supported'
  }

  // Check online status
  function updateOnlineStatus() {
    const isOnline = navigator.onLine
    onlineStatus.textContent = isOnline ? 'Ja' : 'Nein (Offline)'
    onlineStatus.className = isOnline ? 'api-supported' : 'api-not-supported'
    connectionStatus.textContent = isOnline ? 'Online' : 'Offline'
    connectionStatus.className = isOnline ? 'connection online' : 'connection offline'
  }

  updateOnlineStatus()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)

  // Check Cache API
  if ('caches' in window) {
    cacheStatus.textContent = 'Verfuegbar'
    cacheStatus.className = 'api-supported'

    const cacheNames = await caches.keys()
    if (cacheNames.length > 0) {
      cacheStatus.textContent = `${cacheNames.length} Cache(s) aktiv`
    }
  } else {
    cacheStatus.textContent = 'Nicht verfuegbar'
    cacheStatus.className = 'api-not-supported'
  }

  status.textContent = navigator.onLine ? 'Status: Online' : 'Status: Offline'
  status.className = navigator.onLine ? 'status success' : 'status warning'

  testBtn.addEventListener('click', () => {
    result.textContent = `Online-Status: ${navigator.onLine ? 'JA' : 'NEIN'}
Service Worker: ${'serviceWorker' in navigator ? 'Unterstuetzt' : 'Nicht unterstuetzt'}

Test-Anleitung:
1. Schalte WLAN/Mobile Daten aus
2. Lade die Seite neu (oder navigiere)
3. Die App sollte weiterhin funktionieren

Der Footer zeigt den aktuellen Status.`
  })

  clearBtn.addEventListener('click', async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      result.textContent = `${cacheNames.length} Cache(s) geloescht`
      cacheStatus.textContent = '0 Cache(s) aktiv'
    }
  })
}

// ============================================================================
// Push Notifications Module
// ============================================================================

async function initPush() {
  const notificationApi = document.getElementById('notification-api')!
  const notificationPermission = document.getElementById('notification-permission')!
  const pushApi = document.getElementById('push-api')!
  const status = document.getElementById('push-status')!
  const requestBtn = document.getElementById('push-request') as HTMLButtonElement
  const testBtn = document.getElementById('push-test') as HTMLButtonElement
  const result = document.getElementById('push-result')!

  // Check Notification API
  if ('Notification' in window) {
    notificationApi.textContent = 'Verfuegbar'
    notificationApi.className = 'api-supported'
  } else {
    notificationApi.textContent = 'Nicht verfuegbar'
    notificationApi.className = 'api-not-supported'
  }

  // Check current permission
  function updatePermission() {
    if ('Notification' in window) {
      const perm = Notification.permission
      notificationPermission.textContent = perm
      notificationPermission.className = perm === 'granted' ? 'api-supported' :
                                          perm === 'denied' ? 'api-not-supported' : ''

      if (perm === 'granted') {
        testBtn.disabled = false
        status.textContent = 'Status: Bereit'
        status.className = 'status success'
      } else if (perm === 'denied') {
        status.textContent = 'Status: Verweigert'
        status.className = 'status error'
      }
    }
  }
  updatePermission()

  // Check Push API
  if ('PushManager' in window) {
    pushApi.textContent = 'Verfuegbar'
    pushApi.className = 'api-supported'
  } else {
    pushApi.textContent = 'Nicht verfuegbar (benötigt Service Worker)'
    pushApi.className = 'api-not-supported'
  }

  requestBtn.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      result.textContent = 'Notification API nicht verfuegbar'
      return
    }

    try {
      const permission = await Notification.requestPermission()
      updatePermission()

      result.textContent = `Permission: ${permission}

${permission === 'granted' ?
  'Notifications sind erlaubt! Klicke "Test-Notification senden".' :
  permission === 'denied' ?
  'Notifications wurden verweigert. In den Browser-Einstellungen aendern.' :
  'Noch nicht entschieden.'}
`
    } catch (err) {
      result.textContent = `Fehler: ${(err as Error).message}`
    }
  })

  testBtn.addEventListener('click', () => {
    if (Notification.permission !== 'granted') return

    const notification = new Notification('Test-Notification', {
      body: 'Artikel "Kabel Cat6" ist fast leer! Nur noch 2 Stueck.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'test-notification',
      requireInteraction: false
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    result.textContent = `Notification gesendet!

Falls sie nicht angezeigt wird:
- Pruefe "Nicht stoeren" Modus
- Pruefe App-Benachrichtigungseinstellungen
- Bei PWA: Pruefe System-Einstellungen`
  })
}

// ============================================================================
// Install Module
// ============================================================================

let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

async function initInstall() {
  const standaloneStatus = document.getElementById('standalone-status')!
  const promptStatus = document.getElementById('install-prompt-status')!
  const displayMode = document.getElementById('display-mode')!
  const status = document.getElementById('install-status')!
  const installBtn = document.getElementById('install-btn') as HTMLButtonElement
  const result = document.getElementById('install-result')!

  // Check if running as standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  standaloneStatus.textContent = isStandalone ? 'Ja (als App installiert)' : 'Nein (im Browser)'
  standaloneStatus.className = isStandalone ? 'api-supported' : ''

  // Display mode
  const modes = ['standalone', 'minimal-ui', 'fullscreen', 'browser']
  const currentMode = modes.find(mode => window.matchMedia(`(display-mode: ${mode})`).matches) || 'browser'
  displayMode.textContent = currentMode

  if (isStandalone) {
    status.textContent = 'Status: Als App installiert'
    status.className = 'status success'
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    promptStatus.textContent = 'Verfuegbar!'
    promptStatus.className = 'api-supported'
    installBtn.disabled = false
    status.textContent = 'Status: Installation moeglich'
    status.className = 'status success'
  })

  // Listen for app installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    status.textContent = 'Status: App wurde installiert!'
    status.className = 'status success'
    installBtn.disabled = true
    result.textContent = 'Die App wurde erfolgreich installiert!'
  })

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      result.textContent = 'Install Prompt nicht verfuegbar.\n\nMoegliche Gruende:\n- Nicht ueber HTTPS geladen\n- manifest.json fehlt oder fehlerhaft\n- App bereits installiert\n- Browser unterstuetzt keine PWA-Installation'
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    result.textContent = outcome === 'accepted' ?
      'Installation akzeptiert!' :
      'Installation abgelehnt'

    deferredPrompt = null
    installBtn.disabled = true
  })

  // Initial check for HTTPS
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    result.textContent = 'WARNUNG: Fuer PWA-Installation wird HTTPS benoetigt!\n\nAktuelle URL: ' + location.href
    status.textContent = 'Status: HTTPS erforderlich'
    status.className = 'status warning'
  }
}

// ============================================================================
// Service Worker Registration
// ============================================================================

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registered:', registration.scope)
    } catch (err) {
      console.log('SW registration failed:', err)
    }
  }
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTabs()
  initCamera()
  initScanner()
  initStorage()
  initOffline()
  initPush()
  initInstall()
  registerServiceWorker()
})
