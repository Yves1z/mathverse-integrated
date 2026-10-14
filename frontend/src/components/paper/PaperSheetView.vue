<script setup>
import PaperHeading from '../content/PaperHeading.vue'
import { MM, paperQuestionHtml } from '../../utils/paperLayout.js'

const props = defineProps({
  pages: { type: Array, required: true },
  items: { type: Array, required: true },
  sheet: { type: Object, required: true },
  sheetStyle: { type: Object, required: true },
  zoom: { type: Number, required: true },
  title: { type: String, required: true },
  totalScore: { type: Number, required: true },
  headingFor: { type: Function, required: true },
  showScoreFor: { type: Function, required: true },
  // 排版引擎的 DOM 锚点：usePaperSheet 用它们测量与打印。
  bindCanvas: { type: Function, default: null },
  bindMeasure: { type: Function, default: null },
  activeId: { type: String, default: '' },
  dropIndex: { type: Number, default: -1 },
  dragging: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  emptyHint: { type: Boolean, default: false },
})

const emit = defineEmits(['fragment-pointerdown', 'fragment-activate'])

function itemId(index) {
  return props.items[index]?.problem.id ?? ''
}
</script>

<template>
  <div :ref="bindCanvas" class="paper-canvas">
    <div
      v-for="(page, pageIndex) in pages"
      :key="pageIndex"
      class="paper-page-wrap"
      :style="{
        width: `${sheet.width * MM * zoom}px`,
        height: `${sheet.height * MM * zoom}px`,
      }"
    >
      <section
        class="paper-sheet"
        :style="{ ...sheetStyle, zoom }"
        :aria-label="`试卷第 ${pageIndex + 1} 页`"
      >
        <PaperHeading
          v-if="pageIndex === 0"
          :title="title"
          :page-count="pages.length"
          :question-count="items.length"
          :total-score="totalScore"
        />
        <div v-if="emptyHint && !items.length" class="paper-empty">
          <span class="paper-empty-icon">＋</span>
          <h3>拖拽题目到这里</h3>
          <p>或点击题库中的「＋ 加入」</p>
        </div>
        <article
          v-for="(fragment, fi) in page.fragments"
          :key="`${fragment.index}:${fi}`"
          class="paper-fragment"
          :class="{
            'is-active': editable && activeId === itemId(fragment.index),
            'is-drop-target': editable && fragment.first && dropIndex === fragment.index,
          }"
          :data-paper-id="editable ? itemId(fragment.index) : null"
          :draggable="false"
          :style="{ height: `${fragment.height}px` }"
          @pointerdown="editable && emit('fragment-pointerdown', $event)"
          @click="editable && emit('fragment-activate', itemId(fragment.index))"
        >
          <div
            v-if="dragging && fragment.first && dropIndex === fragment.index"
            class="paper-drop-line"
          >
            插入为第 {{ fragment.index + 1 }} 题
          </div>
          <div class="paper-fragment-clip" :style="{ height: `${fragment.height}px` }">
            <div
              class="paper-question-content"
              :style="{
                transform: `scale(${fragment.scale}) translateY(-${fragment.offset}px)`,
                transformOrigin: 'top left',
              }"
              v-html="fragment.html"
            />
          </div>
        </article>
        <div
          v-if="dragging && pageIndex === pages.length - 1 && dropIndex === items.length"
          class="paper-drop-line is-last"
        >
          追加为第 {{ items.length + 1 }} 题
        </div>
        <footer class="paper-page-footer">
          数学试题　第 {{ pageIndex + 1 }} 页（共 {{ pages.length }} 页）
        </footer>
      </section>
    </div>
  </div>

  <div :ref="bindMeasure" class="paper-measure paper-sheet" :style="sheetStyle" aria-hidden="true">
    <PaperHeading
      :title="title"
      :page-count="pages.length"
      :question-count="items.length"
      :total-score="totalScore"
    />
    <div
      v-for="(item, index) in items"
      :key="item.problem.id"
      class="paper-measure-question paper-question-content"
      v-html="paperQuestionHtml(item, index, headingFor(index), showScoreFor(index))"
    />
  </div>
</template>
