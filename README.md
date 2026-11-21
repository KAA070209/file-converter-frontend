# Konversi — Next.js frontend

Antarmuka Next.js untuk File Converter API.

## Menjalankan

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`, lalu sesuaikan URL backend bila perlu:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Jalankan frontend:

```bash
npm run dev
```

Buka `http://localhost:3000`. Backend FastAPI harus aktif di URL yang ditentukan dan mengizinkan origin frontend melalui `CORS_ORIGINS`.

## Fitur

- Konversi satu gambar JPG, PNG, atau WEBP ke JPG, PNG, atau WEBP.
- Konversi dan penggabungan hingga 30 gambar menjadi satu PDF.
- Pengaturan kualitas output dan latar putih untuk gambar transparan yang dikonversi ke JPG.
- Validasi ukuran file maksimal 20 MB per file, sesuai konfigurasi backend default.
- Riwayat konversi dan unduh ulang menggunakan endpoint jobs API.

Atur batas ukuran di antarmuka agar sesuai dengan `MAX_UPLOAD_MB` jika konfigurasi backend berbeda dari default.
