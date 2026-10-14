<script setup>
import { useRouter } from "vue-router";

import wechatQr from "@/assets/payment/wechat.jpg";
import alipayQr from "@/assets/payment/alipay.jpg";

const router = useRouter();
</script>

<template>
  <main class="support-page">
    <!-- 返回 -->
    <button
      class="back-button"
      type="button"
      aria-label="返回上一页"
      @click="router.back()"
    >
      ←
    </button>

    <section class="support-content">
      <!-- 咖啡图标 -->
      <svg
        class="support-coffee"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M8 3c1 1 1 2 0 3" />
        <path d="M12 2c1.2 1.2 1.2 2.4 0 3.6" />
        <path d="M16 3c1 1 1 2 0 3" />

        <path
          d="M5 9h12v4.5A5.5 5.5 0 0 1 11.5 19h-1A5.5 5.5 0 0 1 5 13.5V9Z"
        />

        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />

        <path d="M4 21h15" />
      </svg>

      <h1>Support Mathverse</h1>

      <p class="description">
        如果 Mathverse 对您有所帮助，
        <br>
        可以请我喝一杯咖啡。
      </p>

      <div class="payment-options">
        <!-- 微信 -->
        <div class="payment-item">
          <div class="qr-box">
            <img
              :src="wechatQr"
              alt="微信收款码"
            >
          </div>

          <span>微信</span>
        </div>

        <!-- 支付宝 -->
        <div class="payment-item">
          <div class="qr-box">
            <img
              :src="alipayQr"
              alt="支付宝收款码"
            >
          </div>

          <span>支付宝</span>
        </div>
      </div>

      <p class="thanks">感谢您对 Mathverse 的支持。</p>
    </section>
  </main>
</template>

<style scoped>
.support-page {
  position: relative;

  width: 100%;
  min-height: 100vh;
  min-height: 100svh;

  padding: 62px 24px 72px;

  box-sizing: border-box;

  background: #ffffff;
  color: #334452;

  font-family: var(--font-ui);
  font-size: 15px;
  line-height: 1.7;
}

/* 返回按钮 */
.back-button {
  position: absolute;
  top: 24px;
  left: 24px;

  width: 36px;
  height: 36px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border: none;
  border-radius: 8px;

  background: transparent;

  font-size: 20px;
  color: #345;

  cursor: pointer;

  transition: background-color 0.15s ease;
}

.back-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 页面主体 */
.support-content {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;

  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;
}

/* 咖啡图标 */
.support-coffee {
  width: 44px;
  height: 44px;

  margin-bottom: 34px;

  fill: none;
  stroke: #174f7c;

  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.support-content h1 {
  margin: 0;

  color: #174f7c;
  font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
  font-size: clamp(42px, 2.95vw, 56px);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: 0.005em;
}

/* 描述 */
.description {
  margin: 34px 0 52px;

  font-size: 20px;
  line-height: 1.7;

  color: #7b8794;
}

/* 二维码区域 */
.payment-options {
  display: flex;
  justify-content: center;

  gap: 64px;

  width: 100%;
}

/* 单个支付方式 */
.payment-item {
  display: flex;
  flex-direction: column;
  align-items: center;

  gap: 18px;

  font-size: 20px;
  color: #4d5c68;
}

/* 二维码盒子 */
.qr-box {
  width: 268px;
  height: 268px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 16px;

  box-sizing: border-box;

  background: var(--color-surface);

  border: 1px solid var(--color-border);
  border-radius: 18px;

  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.qr-box:hover {
  transform: translateY(-2px);

  box-shadow:
    0 8px 24px
    rgba(40, 80, 100, 0.08);
}

/* 限死图片尺寸，避免破坏布局 */
.qr-box img {
  display: block;

  width: 100%;
  height: 100%;

  object-fit: contain;
}

/* 底部感谢 */
.thanks {
  margin: 56px 0 0;

  font-size: 20px;
  color: #8a969f;
}

/* 手机 */
@media (max-width: 560px) {
  .payment-options {
    flex-direction: column;
    align-items: center;

    gap: 28px;
  }

  .support-content h1 {
    font-size: 38px;
  }

  .qr-box {
    width: 220px;
    height: 220px;
  }

  .description {
    font-size: 16px;
  }

  .payment-item,
  .thanks {
    font-size: 16px;
  }
}

/*
 * 浏览器有效高度不足时收紧纵向留白。
 * 2680 × 1980 等分辨率在系统缩放和浏览器工具栏占用后，
 * 可用高度可能只有 700～850px。
 */
@media (min-width: 561px) and (max-height: 850px) {
  .support-page {
    padding-top: 34px;
    padding-bottom: 28px;
  }

  .support-coffee {
    margin-bottom: 22px;
  }

  .description {
    margin: 24px 0 32px;
  }

  .thanks {
    margin-top: 28px;
  }
}

@media (min-width: 561px) and (max-height: 700px) {
  .support-page {
    padding-top: 24px;
    padding-bottom: 20px;
  }

  .support-coffee {
    width: 36px;
    height: 36px;

    margin-bottom: 16px;
  }

  .support-content h1 {
    font-size: 44px;
  }

  .description {
    margin: 18px 0 24px;

    font-size: 17px;
    line-height: 1.6;
  }

  .payment-options {
    gap: 48px;
  }

  .payment-item {
    gap: 12px;

    font-size: 16px;
  }

  .qr-box {
    width: 220px;
    height: 220px;
  }

  .thanks {
    margin-top: 20px;

    font-size: 17px;
  }
}
</style>
