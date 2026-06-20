# Yejin Playlist — Backlog (P2, post-v1)

전문가 패널(2026-06-20)이 P2로 분류한 항목. v1 출시(개인·지인용)에는 불필요하나, 사용 빈도가 늘면 검토.

| 항목 | 근거 | 작업량 |
|---|---|---|
| 곡 해석 실패 시 제목/아티스트 **수동 입력 폼** (videoId만으로 곡 생성) | getVideoData 반정식 API가 자주 깨지면 필요. 현재는 에러 메시지 구분(P0)으로 1차 방어 | M |
| 플레이리스트 **ascii 짧은 id**(nanoid 류), 표시 title은 별도 | 한글 slug → URL이 %EC%83%88... 로 인코딩. 외부 공유(#/s/)엔 영향 없음, 호스트 /edit·/p URL만 | S |
| SharedView **'나도 만들기 / 답장 보내기' CTA** (바이럴 루프) | 받는 사람→발신자 전환 동선. 개인용엔 입소문이 유일 채널이라도 출시 필수까진 아님 | M |
| useSongResolver **getMeta 폴링 언마운트 가드 + clearTimeout** | 라우트 전환 시 파괴된 probe player 호출로 resolving 고착 가능. 빈도 낮음 | S |
| storage.writeJson **localStorage quota 초과 분기** | 곡 누적 시 QuotaExceededError가 '재생 불가'로 오인 표시. 개인용은 한계 늦음 | S |
| Editor **신규 방문자 온보딩**(곡 0개 가이드 + 제목 자동 포커스) | 첫 사용자가 막힐 수 있으나 호스트는 대개 본인 | S |
| 동적 **곡별 OG 이미지**(빌드/엣지 프록시) | 정적 호스팅 한계. v1은 고정 브랜드 OG 1장으로 충분 | L |

P0(전부 완료)·P1(전부 완료)은 `2026-06-20-yejin-playlist-implementation.md` 및 git 히스토리 참조.
