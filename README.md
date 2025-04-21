# Game Sepak Bola Multiplayer (HaxBall Clone)

Game sepak bola berbasis web dengan fitur multiplayer menggunakan WebSocket, terinspirasi oleh HaxBall.

## Cara Menjalankan

1. Install dependensi:

   ```
   npm install
   ```

2. Jalankan server:

   ```
   npm start
   ```

3. Buka browser dan akses `http://localhost:3000`

4. Untuk development dengan hot reload:
   ```
   npm run dev
   ```

## Cara Bermain

1. Buka game di browser
2. Tunggu pemain lain bergabung (minimal 2 pemain)
3. Gunakan tombol berikut untuk bermain:
   - **W**: Bergerak ke atas
   - **A**: Bergerak ke kiri
   - **S**: Bergerak ke bawah
   - **D**: Bergerak ke kanan
   - **L**: Berlari (menghabiskan energi)
   - **K**: Dribbling bola
   - **J**: Mengoper/pass bola
   - **Spasi**: Menendang bola (jika cukup dekat dengan bola)

## Fitur

- Multiplayer real-time menggunakan WebSocket
- Pemain yang bisa dikendalikan dengan tim berbeda (merah dan biru)
- Pergerakan sinkron di semua client
- Fisika bola realistis
- Sistem energi untuk berlari
- Ultimate gauge untuk tendangan super
- Sistem skor otomatis
- Gawang di kedua sisi lapangan

## Teknologi

- **Frontend**: HTML5 Canvas, JavaScript
- **Backend**: Node.js, Express
- **Multiplayer**: Socket.IO

## Pengembangan Lanjutan

Game ini dapat dikembangkan lebih lanjut dengan:

- Menambahkan autentikasi pemain
- Menambahkan chat dalam game
- Menambahkan AI untuk latihan
- Menambahkan sistem statistik pemain
- Menambahkan efek suara dan musik
- Membuat lobby untuk beberapa room game

## Kredit

Dibuat sebagai clone multiplayer dari HaxBall (https://www.haxball.com/)
