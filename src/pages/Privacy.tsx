import LegalLayout, { LegalSection } from '../components/LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="개인정보처리방침" updated="2026-06-21">
      <p>
        “Yejin Playlist”(이하 “서비스”)는 별도의 서버 없이 동작하는 정적 웹 서비스로,{' '}
        <strong>이용자의 개인정보를 서버에 수집·저장하지 않습니다.</strong>
      </p>

      <LegalSection heading="1. 수집하는 개인정보">
        <p>
          회원가입·로그인이 없으며 이름·이메일·연락처 등 어떤 개인정보도 수집하지 않습니다. 이용자가
          만든 플레이리스트와 곡 목록은 <strong>이용자의 브라우저(localStorage)에만 저장</strong>되며,
          운영자는 이 데이터에 접근할 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection heading="2. 제3자 서비스">
        <p>재생·가사·썸네일을 위해 아래 외부 서비스를 이용하며, 각 서비스가 자체 정책에 따라 정보를 처리할 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>YouTube(Google)</strong> — 영상 임베드 재생. Google의 개인정보처리방침·쿠키 정책이 적용됩니다.</li>
          <li><strong>LRCLIB</strong> — 가사 조회.</li>
          <li><strong>i.ytimg.com(Google)</strong> — 앨범 썸네일 이미지.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 쿠키">
        <p>
          본 서비스는 자체 쿠키를 사용하지 않습니다. 다만 임베드된 YouTube 플레이어가 쿠키를 설정할 수
          있으며, 이는 Google의 정책을 따릅니다.
        </p>
      </LegalSection>

      <LegalSection heading="4. 공유 링크에 담기는 정보">
        <p>
          플레이리스트를 공유하면 제목·메시지·보낸 사람 이름이 링크(URL)에 인코딩됩니다. 이는 암호화가
          아니므로 <strong>링크를 받은 사람은 누구나 그 내용을 볼 수 있습니다.</strong> 민감한
          개인정보는 메시지에 입력하지 마세요.
        </p>
      </LegalSection>

      <LegalSection heading="5. 데이터 보관 및 삭제">
        <p>
          모든 데이터는 이용자의 브라우저에 저장됩니다. 앱 내 삭제 기능, 또는 브라우저의 사이트
          데이터/저장소 삭제로 언제든 직접 제거할 수 있습니다. ‘내보내기’로 백업 파일을 받을 수도
          있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 아동의 개인정보">
        <p>본 서비스는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.</p>
      </LegalSection>

      <LegalSection heading="7. 변경 및 문의">
        <p>
          본 방침은 변경될 수 있으며, 변경 시 본 페이지에 게시합니다. 문의:{' '}
          <a
            href="https://github.com/wannahappyaroundme/playlist"
            className="underline hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            github.com/wannahappyaroundme/playlist
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
