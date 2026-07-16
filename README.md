# LearnLoop

เว็บตัวอย่างติดตามบทเรียนแบบครบวงจร เชื่อม Firebase Authentication และ Cloud Firestore

## จุดเด่น

- เพิ่ม ทำเครื่องหมายสำเร็จ กรอง และลบบทเรียน
- Anonymous Authentication แยกข้อมูลของผู้ใช้แต่ละเบราว์เซอร์
- Firestore Security Rules ตรวจสิทธิ์และรูปแบบข้อมูล
- จำกัด 30 รายการต่อผู้ใช้และใช้ snapshot listener เดียวเพื่อประหยัด Spark quota
- Responsive และ deploy ได้ทั้ง Firebase Hosting / GitHub Pages

## รันในเครื่อง

เปิด static server ที่โฟลเดอร์นี้ แล้วเข้าผ่าน `http://localhost:4173`

> ต้องตั้งค่า `firebase-config.js`, เปิด Anonymous Authentication และ deploy `firestore.rules` ก่อนใช้งานข้อมูลจริง
