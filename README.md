# Game Sepak Bola Multiplayer (HaxBall Clone)

Game sepak bola berbasis web multiplayer yang terinspirasi oleh HaxBall.

## Fitur

- Permainan multiplayer real-time menggunakan WebSocket
- Pemain bisa bergerak, menendang, mengoper dan mendribble bola
- Sistem energi untuk berlari
- Ultimate gauge yang terisi saat dribbling untuk tendangan super
- Fisika bola realistis
- Sistem skor otomatis
- Gawang di kedua sisi lapangan

## Cara Bermain

### Setup Server

1. Install dependensi:

   ```
   npm install
   ```

2. Jalankan server:

   ```
   npm start
   ```

3. Buka browser di alamat http://localhost:3000

### Kontrol Permainan

- **W**: Bergerak ke atas
- **A**: Bergerak ke kiri
- **S**: Bergerak ke bawah
- **D**: Bergerak ke kanan
- **K**: Dribbling bola (menempel pada pemain)
- **J**: Pass/mengoper bola
- **Spasi**: Menendang bola (jika cukup dekat dengan bola)
- **L**: Berlari (energi akan berkurang)

## Teknologi yang Digunakan

- **Frontend**: HTML5 Canvas, JavaScript vanilla
- **Backend**: Node.js, Express, WebSocket (ws)
- **Komunikasi**: Protokol WebSocket untuk permainan real-time

## Pengembangan

Game ini masih bisa dikembangkan lebih lanjut dengan:

- Menambahkan otentikasi pemain
- Membuat sistem room/lobby
- Menambahkan chat dalam game
- Meningkatkan sistem kolisi dan fisika
- Menambahkan fitur AI untuk pemain komputer
- Menambahkan efek suara dan musik
- Menambahkan mode permainan lain

## Kredit

Dibuat sebagai clone sederhana dari HaxBall (https://www.haxball.com/)
