# 문제 해결 가이드

## 현재 상황
- 클라이언트 포트: **3333**
- 서버 포트: **5000**

## 접속 주소
- 클라이언트: http://localhost:3333
- 서버 API: http://localhost:5000

## 빈 화면이 나오는 경우

### 1. 포트 확인
브라우저에서 **http://localhost:3333**로 접속하세요 (3334가 아님)

### 2. 서버 실행 확인
터미널 1에서 서버가 실행 중인지 확인:
```bash
cd server
npm run dev
```

### 3. 클라이언트 실행 확인
터미널 2에서 클라이언트가 실행 중인지 확인:
```bash
cd client
npm start
```

### 4. 브라우저 콘솔 확인
- F12를 눌러 개발자 도구 열기
- Console 탭에서 에러 메시지 확인
- Network 탭에서 API 요청 실패 여부 확인

### 5. 컴파일 에러 확인
터미널에서 컴파일 에러가 있는지 확인하고, 에러가 있으면 수정

## i18n 에러가 있는 경우
패키지가 설치되었는지 확인:
```bash
cd client
npm install i18next react-i18next i18next-browser-languagedetector
```

