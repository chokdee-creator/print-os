# แจ้งยอดขายร้านปริ้นอิมเมจเข้า LINE

สถานะ: เตรียมโค้ดแล้ว ยังไม่ได้ติดตั้งบนบัญชี Google หรือเปิดส่งจริง

## เวลาส่ง

- ทุกวัน เริ่มตรวจส่งตั้งแต่ 21:00 น. เวลาไทย
- วันที่ 15: เพิ่มยอดวันที่ 1–15 ในข้อความเดียวกับยอดรายวัน
- วันสุดท้ายของเดือน: เพิ่มยอดวันที่ 16–สิ้นเดือนในข้อความเดียวกัน รองรับกุมภาพันธ์และปีอธิกสุรทิน
- ตรวจทุก 5 นาที การทำงานจริงอาจล่าช้าตามบริการ Google ไม่รับประกันตรงวินาที
- ยอดคำนวณตามคอลัมน์วันที่งาน รวมเฉพาะข้อมูลที่ซิงก์เข้า Google Sheets แล้ว ณ เวลาส่ง งานที่เพิ่มหลังส่งไม่ถูกส่งแก้ย้อนหลังโดยอัตโนมัติ
- จำนวนรายการหมายถึงจำนวนแถวงาน ไม่ใช่จำนวนใบเสร็จหรือจำนวนชิ้น

## 1. เตรียม LINE OA

1. เปิด https://manager.line.biz/ เลือก OA ที่จะใช้ แล้วเข้า Settings / ตั้งค่า → Messaging API และเปิดใช้งานหากยังไม่เปิด
2. เปิด https://developers.line.biz/console/ เลือก Provider และ Messaging API channel ของ OA นี้
3. แท็บ Messaging API: ออก Channel access token (long-lived)
4. แท็บ Basic settings: คัดลอก Your user ID ของคุณเอง เป็นค่า U ตามด้วยตัวอักษร/ตัวเลข 32 หลัก ไม่ใช่ LINE ID ที่ใช้ค้นหาเพื่อน หากไม่แสดง ให้เชื่อม LINE ส่วนตัวกับ Business ID ตามคู่มือ LINE
5. ใช้ LINE ส่วนตัวที่จะรับรายงานเพิ่ม OA นี้เป็นเพื่อน และอย่าบล็อกบัญชี

เก็บ token ใน Script Properties ฝั่ง Apps Script เท่านั้น ไม่ใส่ในหน้าเว็บหรือ GitHub และไม่จำเป็นต้องส่ง token ในแชต

## 2. เพิ่มส่วนเสริมใน Google Apps Script

1. เปิด Google Sheet ที่เว็บปริ้นอิมเมจใช้งาน → Extensions / ส่วนขยาย → Apps Script
2. เพิ่มไฟล์ Script ชื่อ PrintImageReports แล้ววางเนื้อหาจาก print-image-line-reports.gs ทั้งหมดเป็นไฟล์ใหม่ เก็บโค้ดเดิมไว้
3. เข้า Project Settings / การตั้งค่าโครงการ → Script Properties / คุณสมบัติสคริปต์ เพิ่มค่า:

| Property | Value |
|---|---|
| PRINT_REPORT_SPREADSHEET_ID | ส่วนระหว่าง /d/ และ /edit ใน URL ของ Google Sheet |
| PRINT_REPORT_SHEET_NAME | Data Account ตามไฟล์เว็บเดิม หรือชื่อแท็บที่เว็บใช้อยู่จริง |
| PRINT_REPORT_LINE_TOKEN | Channel access token จาก OA |
| PRINT_REPORT_LINE_USER_ID | Your user ID ของผู้รับ |

4. เลือกฟังก์ชัน previewPrintImageReport → Run / เรียกใช้ → อนุญาตการเข้าถึง Google Sheets แล้วตรวจข้อความใน Execution log
5. ตรวจว่าแท็บนี้เป็นข้อมูลของร้านปริ้นอิมเมจเท่านั้น และยอดตรงกับเว็บ หากรวมข้อมูลหลายร้าน ห้ามเปิดส่งจนกว่าจะแยกแหล่งข้อมูลถูกต้อง โค้ดนี้ไม่กรองชื่อร้านจากแถว
6. เมื่อข้อมูลถูกต้อง เพิ่ม Script Property: PRINT_REPORT_STORE_CONFIRMED = true
7. เลือก enablePrintImageReports → Run และอนุญาตสิทธิ์การตั้งเวลา/เรียกบริการภายนอก นี่คือขั้นตอนเปิดส่งอัตโนมัติจริง

ไม่ต้อง deploy เว็บเวอร์ชันใหม่เพื่อให้ trigger นี้ทำงาน คอมพิวเตอร์ไม่ต้องเปิดค้าง การส่งเกิดบนบัญชี Google ที่ติดตั้ง trigger

## ตรวจสอบและหยุด

- previewPrintImageReport แสดงตัวอย่างเท่านั้น ไม่ส่งข้อความ
- sendScheduledPrintImageReports หากเรียกเองหลัง 21:00 น. จะส่งรายงานจริง และบันทึกว่าส่งประจำวันแล้ว
- Apps Script → Executions แสดงข้อผิดพลาด กรณี token ผิดหรือโควตาไม่พอ ระบบจะไม่ทำเครื่องหมายว่าสำเร็จ
- ป้องกันการส่งซ้ำภายในวันด้วย lock, delivery state และ LINE retry key; การตอบรับ API ไม่ได้ยืนยันว่าผู้รับอ่านหรือได้รับจริง หากผู้รับบล็อก OA อาจไม่เห็นข้อความ
- หากระบบไม่ทำงานตลอดช่วง 21:00–สิ้นวัน จะไม่ชดเชยรายงานวันเก่าอัตโนมัติ
- หยุดโดยเรียก disablePrintImageReports ซึ่งลบเฉพาะ trigger ของส่วนเสริมนี้
- การส่งใช้โควตาข้อความของ LINE OA ตามแผนที่ใช้อยู่

## เอกสารอ้างอิง

- https://developers.line.biz/en/docs/messaging-api/getting-started/
- https://developers.line.biz/en/docs/messaging-api/getting-user-ids/
- https://developers.line.biz/en/reference/messaging-api/#send-push-message
- https://developers.google.com/apps-script/guides/triggers/installable
