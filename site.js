/* =========================================================================
   GLean — animações da landing page (GSAP + ScrollTrigger)
   ========================================================================= */
(function () {
  "use strict";

  document.getElementById("ano").textContent = new Date().getFullYear();

  var reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var temGsap = typeof window.gsap !== "undefined";

  // Sem GSAP (CDN bloqueado) ou com movimento reduzido, a página fica estática
  // e completamente legível: nada depende da animação para aparecer.
  if (!temGsap || reduzirMovimento) {
    document.querySelectorAll("[data-anim]").forEach(function (el) {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
    var prog = document.querySelector(".lt-progresso");
    if (prog) prog.style.transform = "scaleY(1)";
    document.querySelectorAll(".lt-item").forEach(function (i) { i.classList.add("ativo"); });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var suave = "power3.out";

  /* ------------------------------------------------------------------
     1) Entrada da hero — encadeada, do selo aos botões
     ------------------------------------------------------------------ */
  var entrada = gsap.timeline({ defaults: { ease: suave } });

  entrada.from(".hero-foto-mobile", {
    opacity: 0, y: 28, scale: .96, duration: 1.1,
  }, 0);

  entrada.from('[data-anim="titulo"]', {
    opacity: 0, y: 34, duration: 1.1,
  }, 0.12);

  entrada.from('.hero [data-anim="hero"]', {
    opacity: 0, y: 22, duration: .9, stagger: .12,
  }, 0.28);

  /* ------------------------------------------------------------------
     2) Ornamentos de fundo — deriva lenta e parallax de scroll
     ------------------------------------------------------------------ */
  gsap.to(".orb-1", {
    x: -60, y: 40, duration: 18, ease: "sine.inOut", yoyo: true, repeat: -1,
  });
  gsap.to(".orb-2", {
    x: 50, y: -34, duration: 22, ease: "sine.inOut", yoyo: true, repeat: -1,
  });
  gsap.to(".anel-1", { rotation: 360, duration: 140, ease: "none", repeat: -1 });
  gsap.to(".anel-2", { rotation: -360, duration: 190, ease: "none", repeat: -1 });

  gsap.to(".fundo-orn", {
    y: -120,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 1 },
  });

  /* ------------------------------------------------------------------
     3) Revelações no scroll
     ------------------------------------------------------------------ */
  gsap.utils.toArray('[data-anim="sobe"]').forEach(function (el) {
    gsap.from(el, {
      opacity: 0, y: 30, duration: .9, ease: suave,
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  // Cartões entram em cascata dentro de cada grupo.
  document.querySelectorAll(".cartoes, .depoimentos").forEach(function (grupo) {
    gsap.from(grupo.querySelectorAll('[data-anim="cartao"]'), {
      opacity: 0, y: 40, duration: .85, ease: suave, stagger: .1,
      scrollTrigger: { trigger: grupo, start: "top 84%" },
    });
  });

  // Pílulas das marcas: entrada rápida e escalonada.
  document.querySelectorAll(".marcas").forEach(function (lista) {
    gsap.from(lista.querySelectorAll('[data-anim="marca"]'), {
      opacity: 0, y: 18, scale: .94, duration: .55, ease: "back.out(1.6)", stagger: .045,
      scrollTrigger: { trigger: lista, start: "top 86%" },
    });
  });

  /* ------------------------------------------------------------------
     4) Linha do tempo — trilho preenche conforme o scroll e cada
        marco acende ao chegar no meio da tela
     ------------------------------------------------------------------ */
  var linhaTempo = document.querySelector(".linha-tempo");
  if (linhaTempo) {
    // O trilho acompanha a leitura: começa a crescer quando a lista entra de
    // fato na tela e só completa quando o último item passa do meio dela.
    gsap.to(".lt-progresso", {
      scaleY: 1,
      ease: "none",
      scrollTrigger: {
        trigger: linhaTempo,
        start: "top 55%",
        end: "bottom 60%",
        scrub: .6,
      },
    });

    gsap.utils.toArray(".lt-item").forEach(function (item, i) {
      // acende / apaga acompanhando a direção do scroll
      ScrollTrigger.create({
        trigger: item,
        start: "top 62%",
        onEnter: function () { item.classList.add("ativo"); },
        onLeaveBack: function () { item.classList.remove("ativo"); },
      });

      // desloca para a esquerda: um x positivo empurraria o documento para
      // fora da viewport e criaria rolagem horizontal no mobile
      gsap.from(item.querySelector(".lt-cartao"), {
        opacity: 0, x: -28, duration: .8, ease: suave,
        scrollTrigger: { trigger: item, start: "top 82%" },
      });
      gsap.from(item.querySelector(".lt-marco"), {
        opacity: 0, scale: .6, duration: .6, ease: "back.out(2)",
        scrollTrigger: { trigger: item, start: "top 82%" },
      });
    });
  }

  /* ------------------------------------------------------------------
     5) Mouse — brilho que segue o cursor e inclinação sutil nos cartões
     ------------------------------------------------------------------ */
  var fino = window.matchMedia("(pointer: fine)").matches;

  if (fino) {
    var hero = document.querySelector(".hero");
    var brilho = document.querySelector(".hero-brilho");
    if (hero && brilho) {
      var px = gsap.quickTo(brilho, "--mx", { duration: .8, ease: "power2.out" });
      var py = gsap.quickTo(brilho, "--my", { duration: .8, ease: "power2.out" });
      hero.addEventListener("mousemove", function (e) {
        var r = hero.getBoundingClientRect();
        px(((e.clientX - r.left) / r.width) * 100 + "%");
        py(((e.clientY - r.top) / r.height) * 100 + "%");
      });
    }

    // inclinação 3D leve, proporcional à distância do centro
    document.querySelectorAll(".cartao, .depoimento, .lt-cartao").forEach(function (c) {
      var rx = gsap.quickTo(c, "rotationX", { duration: .5, ease: "power2.out" });
      var ry = gsap.quickTo(c, "rotationY", { duration: .5, ease: "power2.out" });

      c.addEventListener("mousemove", function (e) {
        var r = c.getBoundingClientRect();
        rx(((e.clientY - r.top) / r.height - .5) * -7);
        ry(((e.clientX - r.left) / r.width - .5) * 7);
      });
      c.addEventListener("mouseleave", function () { rx(0); ry(0); });

      gsap.set(c, { transformPerspective: 900, transformStyle: "preserve-3d" });
    });
  }

  /* ------------------------------------------------------------------
     6) Botões — leve reação magnética ao cursor
     ------------------------------------------------------------------ */
  if (fino) {
    document.querySelectorAll(".btn-principal, .btn-secundario").forEach(function (b) {
      var mx = gsap.quickTo(b, "x", { duration: .4, ease: "power3.out" });
      var my = gsap.quickTo(b, "y", { duration: .4, ease: "power3.out" });

      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * .18);
        my((e.clientY - r.top - r.height / 2) * .3);
      });
      b.addEventListener("mouseleave", function () { mx(0); my(0); });
    });
  }
})();
