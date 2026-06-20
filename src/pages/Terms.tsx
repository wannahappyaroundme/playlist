import LegalLayout, { LegalSection } from '../components/LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="이용약관" updated="2026-06-21">
      <p>
        본 약관은 “Yejin Playlist”(이하 “서비스”)의 이용 조건을 정합니다. 서비스를 이용하면 본 약관에
        동의한 것으로 봅니다.
      </p>

      <LegalSection heading="1. 서비스 내용">
        <p>
          본 서비스는 이용자가 입력한 YouTube 링크를 YouTube 임베드 플레이어로 재생하고, 곡 가사를
          화면에 표시하는 <strong>개인용·비영리 가사 비주얼라이저</strong>입니다. 별도의 서버 없이
          이용자의 웹 브라우저에서 동작하며, 오디오 파일을 다운로드하거나 추출하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="2. 이용자의 책임">
        <p>
          이용자는 본인이 추가하거나 공유하는 링크 및 콘텐츠에 대해 책임을 집니다. 타인의 저작권 등
          권리를 침해하거나 불법적인 콘텐츠를 공유해서는 안 됩니다.
        </p>
      </LegalSection>

      <LegalSection heading="3. 콘텐츠와 저작권">
        <p>
          재생되는 영상·음원·가사에 대한 권리는 각 권리자에게 있습니다. 본 서비스는 YouTube가 제공하는
          임베드 플레이어를 통해 재생만 하며, YouTube 서비스 약관을 준수합니다. 가사는 외부
          데이터(LRCLIB 등)에서 조회하여 화면 표시 용도로만 사용합니다.
        </p>
      </LegalSection>

      <LegalSection heading="4. 면책">
        <p>
          본 서비스는 “있는 그대로(as-is)” 제공됩니다. 재생·가사·썸네일 기능은 YouTube, LRCLIB 등
          외부 서비스의 가용성과 정확성에 의존하므로, 재생 불가·가사 부정확·서비스 중단·데이터 손실
          등에 대해 운영자는 법이 허용하는 범위에서 책임을 지지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="5. 금지 행위">
        <p>
          불법 콘텐츠 공유, 타인 권리 침해, 서비스의 비정상적 이용 또는 자동화된 대량 요청, 오디오
          추출·다운로드 시도 등은 금지됩니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 약관의 변경">
        <p>본 약관은 변경될 수 있으며, 변경 시 본 페이지에 게시합니다.</p>
      </LegalSection>

      <LegalSection heading="7. 준거법 및 문의">
        <p>
          본 약관은 대한민국 법을 준거법으로 합니다. 문의:{' '}
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
