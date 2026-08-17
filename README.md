# ⚡ UtilityHub

A free, privacy-first collection of online utility tools built with Next.js 14, deployed on GitHub Pages.

**🌐 Live:** [https://mightycgm.github.io/Mightycgm-Utility](https://mightycgm.github.io/Mightycgm-Utility)

---

## 🛠 Tools Available

| Tool | Description |
|------|-------------|
| 📷 **QR Code Suite** | Generate & decode QR codes |
| ✂️ **Background Remover** | AI-powered BG removal (client-side WASM) |
| 🎨 **Color Picker** | 7 picker types + HEX/RGB/HSL/CMYK/HSV converter |
| 📄 **PDF Tools** | Merge, split, PDF↔Images |
| 📝 **Text Share** | Share long text via JSONBin.io |
| 📋 **Log Share** | Share code/logs with syntax highlighting |
| 🖼️ **Image Tools** | Compress & convert images |
| {} **JSON Tools** | Format, validate, minify JSON |
| 🔧 **Dev Tools** | Base64, URL encode, Hash, JWT, UUID, Regex |
| ✏️ **Text Tools** | Diff, Markdown preview, Word counter |
| 🔄 **Converters** | Unit, number base (bin/oct/hex), timestamp |

---

## 🔒 Privacy First

- All processing happens **in your browser**
- No data is uploaded to any server (except Text/Log Share via your own JSONBin API key)
- No login required

---

## 🚀 Deploy

This project auto-deploys to GitHub Pages via GitHub Actions on every push to `main`.

### Local Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

---

## ⚙️ Tech Stack

- **Framework:** Next.js 16 (App Router, Static Export)
- **Styling:** Tailwind CSS v4
- **Libraries:** jsQR, qrcode, @imgly/background-removal, pdf-lib, pdfjs-dist, react-colorful, prism-react-renderer, crypto-js, and more
- **Deployment:** GitHub Pages via GitHub Actions

---

## 📝 Setup JSONBin.io (for Text/Log Share)

1. Create a free account at [jsonbin.io](https://jsonbin.io)
2. Copy your **Master Key** from the API Keys section
3. Go to **Settings** in the app and paste your key

---

## 📄 License

MIT — Free to use and modify.
