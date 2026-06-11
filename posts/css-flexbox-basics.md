CSS 레이아웃을 처음 배울 때 가장 많이 마주치는 것이 Flexbox입니다. `display: flex` 한 줄로 자식 요소들의 정렬과 간격을 손쉽게 제어할 수 있어, 오늘날 웹 개발의 필수 도구가 됐습니다.

## Flexbox란?

Flexbox(Flexible Box Layout)는 **한 방향(가로 또는 세로)으로 아이템을 배치**하는 데 최적화된 CSS 레이아웃 모델입니다. 부모 요소에 `display: flex`를 선언하면, 그 직계 자식들이 *flex 아이템*이 됩니다.

```css
.container {
  display: flex;
}
```

이것만으로 자식 요소들이 가로로 나란히 줄을 섭니다.

## 자주 쓰는 속성 정리

### 주축 방향 — `flex-direction`

| 값 | 설명 |
|---|---|
| `row` (기본값) | 가로(왼→오른쪽) 배치 |
| `row-reverse` | 가로(오→왼쪽) 배치 |
| `column` | 세로(위→아래) 배치 |
| `column-reverse` | 세로(아래→위) 배치 |

### 주축 정렬 — `justify-content`

아이템들을 **주축** 방향으로 어떻게 정렬할지 결정합니다.

```css
.container {
  display: flex;
  justify-content: space-between; /* 양 끝 정렬, 사이 공간 균등 분배 */
}
```

자주 쓰는 값: `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`

### 교차축 정렬 — `align-items`

주축에 **수직인 방향**으로 아이템을 정렬합니다.

```css
.container {
  display: flex;
  align-items: center; /* 세로 중앙 정렬 */
}
```

자주 쓰는 값: `stretch`(기본값), `flex-start`, `flex-end`, `center`, `baseline`

### 줄 바꿈 — `flex-wrap`

아이템이 컨테이너보다 클 때 줄을 바꿀지 결정합니다.

```css
.container {
  display: flex;
  flex-wrap: wrap; /* 공간이 부족하면 다음 줄로 */
}
```

## 아이템에 쓰는 속성

### 비율로 크기 조절 — `flex`

`flex` 속성은 `flex-grow`, `flex-shrink`, `flex-basis`의 단축 표현입니다.

```css
.item {
  flex: 1; /* 남은 공간을 균등하게 차지 */
}

.item-wide {
  flex: 2; /* 다른 아이템의 두 배 너비 */
}
```

## 실전 예제: 카드 목록

```html
<div class="card-list">
  <div class="card">카드 1</div>
  <div class="card">카드 2</div>
  <div class="card">카드 3</div>
</div>
```

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;            /* 아이템 간격 */
}

.card {
  flex: 1 1 200px;      /* 최소 200px, 공간 있으면 늘어남 */
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}
```

`flex: 1 1 200px`은 "기본 크기 200px에서 늘어나거나 줄어들 수 있다"는 뜻입니다. 모바일에서는 한 열, 태블릿 이상에서는 여러 열로 자동으로 배치됩니다.

## 수직·수평 완전 중앙 정렬

```css
.center-box {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
```

이 세 줄만으로 화면 정중앙에 요소를 배치할 수 있습니다. float 시대에 이런 정렬이 얼마나 고통스러웠는지 생각하면, Flexbox는 진정한 혁신입니다.

## 한 줄 요약

> **부모에 `display: flex`**, 가로 정렬은 `justify-content`, 세로 정렬은 `align-items`, 크기 분배는 자식의 `flex`.

이 네 가지만 익혀도 대부분의 레이아웃을 해결할 수 있습니다.
