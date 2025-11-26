document.addEventListener('DOMContentLoaded', () => {
    // Constantes do jogo
    const GRAVITY = 0.7;
    const MOVE_SPEED = 2.3;
    const JUMP_FORCE = -8;
    const CANVAS_WIDTH = 360;
    const CANVAS_HEIGHT = 200;
    const FALL_RESET_THRESHOLD = 50;
    const FALL_MESSAGE_DURATION = 1500;

    // Elementos do DOM
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const messageScreen = document.getElementById('message-screen');
    const levelCompleteScreen = document.getElementById('level-complete-screen');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const clueElement = document.getElementById('clue');
    const levelTitle = document.getElementById('level-title');
    const levelDescription = document.getElementById('level-description');
    const levelCompleteText = document.getElementById('level-complete-text');

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas não encontrado!');
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Contexto do canvas não disponível!');
        return;
    }

    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const jumpBtn = document.getElementById('jump-btn');

    // Estado do jogo
    const keys = { left: false, right: false, up: false };
    let player, platforms, goal, gameWon, animationId, isGameActive = false;
    let fallMessageTimeout = null;
    let currentLevel = 0;
    
    // Configurações das fases
    const LEVELS = [
        {
            title: "Fase 1: Catedral Nossa Senhora do Desterro",
            description: "Explore este marco histórico de Jundiaí!",
            clue: "Chega até a catedral no topo sem cair.",
            bgColor: '#e8f4f8',
            platformColor: '#8b9dc3',
            goalColor: '#d4a574',
            goalEmoji: '⛪',
            platforms: [
                { x: 0,   y: 170, width: CANVAS_WIDTH, height: 30 },  // chão
                { x: 50,  y: 140, width: 50,  height: 10 },
                { x: 120, y: 115, width: 60,  height: 10 },
                { x: 200, y: 90,  width: 70,  height: 10 },
                { x: 290, y: 65,  width: 50,  height: 10 }
            ],
            goal: { x: 300, y: 35, size: 18 },
            playerStart: { x: 20, y: 140 }
        },
        {
            title: "Fase 2: Mosteiro de São Bento",
            description: "Um dos edifícios mais antigos de Jundiaí, fundado em 1667!",
            clue: "Atravesse os degraus do mosteiro com cuidado.",
            bgColor: '#f5f0e8',
            platformColor: '#9d8b6f',
            goalColor: '#c9a961',
            goalEmoji: '🏛️',
            platforms: [
                { x: 0,   y: 170, width: CANVAS_WIDTH, height: 30 },  // chão
                { x: 40,  y: 150, width: 40,  height: 10 },
                { x: 100, y: 130, width: 50,  height: 10 },
                { x: 170, y: 110, width: 60,  height: 10 },
                { x: 250, y: 90,  width: 50,  height: 10 },
                { x: 320, y: 70,  width: 30,  height: 10 }
            ],
            goal: { x: 330, y: 40, size: 18 },
            playerStart: { x: 20, y: 140 }
        },
        {
            title: "Fase 3: Teatro Polytheama",
            description: "O maior teatro do estado de São Paulo na década de 1920!",
            clue: "Alcance o palco do teatro histórico.",
            bgColor: '#fff5e6',
            platformColor: '#b8860b',
            goalColor: '#daa520',
            goalEmoji: '🎭',
            platforms: [
                { x: 0,   y: 170, width: CANVAS_WIDTH, height: 30 },  // chão
                { x: 30,  y: 145, width: 45,  height: 10 },
                { x: 90,  y: 120, width: 55,  height: 10 },
                { x: 160, y: 95,  width: 65,  height: 10 },
                { x: 240, y: 70,  width: 55,  height: 10 },
                { x: 310, y: 45,  width: 40,  height: 10 }
            ],
            goal: { x: 320, y: 15, size: 18 },
            playerStart: { x: 20, y: 140 }
        }
    ];

    // Função para parar o loop de animação
    function stopGameLoop() {
        if (animationId !== undefined && animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // Função para mostrar mensagem de queda
    function showFallMessage() {
        if (clueElement) {
            const originalText = clueElement.textContent;
            clueElement.textContent = "Ops! Caiu! Tenta de novo...";
            clueElement.style.color = '#e74c3c';
            
            if (fallMessageTimeout) {
                clearTimeout(fallMessageTimeout);
            }
            
            fallMessageTimeout = setTimeout(() => {
                clueElement.textContent = originalText;
                clueElement.style.color = '';
            }, FALL_MESSAGE_DURATION);
        }
    }

    function loadLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= LEVELS.length) return;
        
        const level = LEVELS[levelIndex];
        currentLevel = levelIndex;
        
        // Atualizar informações da fase
        if (levelTitle) levelTitle.textContent = level.title;
        if (levelDescription) levelDescription.textContent = level.description;
        if (clueElement) {
            clueElement.textContent = level.clue;
            clueElement.style.color = '';
        }
        
        // Configurar plataformas e objetivo
        platforms = JSON.parse(JSON.stringify(level.platforms)); // Deep copy
        goal = { ...level.goal };
        
        // Resetar jogador
        player = {
            x: level.playerStart.x,
            y: level.playerStart.y,
            width: 16,
            height: 20,
            vx: 0,
            vy: 0,
            onGround: false
        };
        
        gameWon = false;
    }

    function resetGame() {
        // Limpar mensagem de queda se existir
        if (fallMessageTimeout) {
            clearTimeout(fallMessageTimeout);
            fallMessageTimeout = null;
        }
        
        // Carregar a fase atual
        loadLevel(currentLevel);
    }

    function rectIntersect(a, b) {
        return !(
            a.x + a.width  <= b.x ||
            a.x >= b.x + b.width ||
            a.y + a.height <= b.y ||
            a.y >= b.y + b.height
        );
    }

    function update() {
        if (!isGameActive || !player) return;

        player.vx = 0;
        if (keys.left)  player.vx = -MOVE_SPEED;
        if (keys.right) player.vx = MOVE_SPEED;

        player.vy += GRAVITY;

        player.x += player.vx;

        // Limites horizontais
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) {
            player.x = canvas.width - player.width;
        }

        player.y += player.vy;
        player.onGround = false;

        // Sistema de colisão melhorado
        const prevX = player.x - player.vx;
        const prevY = player.y - player.vy;
        
        platforms.forEach(p => {
            const playerRect = {
                x: player.x,
                y: player.y,
                width: player.width,
                height: player.height
            };
            const platformRect = {
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height
            };

            if (rectIntersect(playerRect, platformRect)) {
                const prevBottom = prevY + player.height;
                const platformTop = p.y;
                const platformBottom = p.y + p.height;
                const prevTop = prevY;

                // Colisão ao cair (pousar em cima da plataforma) - prioridade
                if (player.vy > 0 && prevBottom <= platformTop) {
                    player.y = platformTop - player.height;
                    player.vy = 0;
                    player.onGround = true;
                }
                // Colisão ao subir (cabeça bate embaixo da plataforma)
                else if (player.vy < 0 && prevTop >= platformBottom) {
                    player.y = platformBottom;
                    player.vy = 0;
                }
                // Colisão lateral - apenas se não estiver caindo/subindo muito rápido
                else if (Math.abs(player.vy) < 2) {
                    // Colisão lateral direita (jogador vindo da esquerda)
                    if (player.vx > 0 && prevX + player.width <= p.x) {
                        player.x = p.x - player.width;
                    }
                    // Colisão lateral esquerda (jogador vindo da direita)
                    else if (player.vx < 0 && prevX >= p.x + p.width) {
                        player.x = p.x + p.width;
                    }
                }
            }
        });

        // Detectar queda
        if (player.y > canvas.height + FALL_RESET_THRESHOLD) {
            showFallMessage();
            resetGame();
        }

        // Detectar vitória
        const goalRect = { x: goal.x, y: goal.y, width: goal.size, height: goal.size };
        const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };

        if (rectIntersect(playerRect, goalRect) && !gameWon) {
            gameWon = true;
            stopGameLoop();
            isGameActive = false;

            setTimeout(() => {
                // Verificar se há próxima fase
                if (currentLevel < LEVELS.length - 1) {
                    // Mostrar tela de fase completa
                    if (gameScreen) gameScreen.classList.add('hidden');
                    if (levelCompleteScreen) {
                        const nextLevel = LEVELS[currentLevel + 1];
                        if (levelCompleteText) {
                            levelCompleteText.textContent = `Você completou ${LEVELS[currentLevel].title}! Pronto para ${nextLevel.title}?`;
                        }
                        levelCompleteScreen.classList.remove('hidden');
                    }
                } else {
                    // Todas as fases completas
                    if (gameScreen) gameScreen.classList.add('hidden');
                    if (messageScreen) messageScreen.classList.remove('hidden');
                }
            }, 400);
        }
    }

    function draw() {
        if (!isGameActive || !player || !platforms || !goal) return;
        
        const level = LEVELS[currentLevel];
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fundo com cor da fase
        ctx.fillStyle = level.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Plataformas com cor da fase
        ctx.fillStyle = level.platformColor;
        platforms.forEach(p => {
            ctx.fillRect(p.x, p.y, p.width, p.height);
            // Adicionar borda nas plataformas
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x, p.y, p.width, p.height);
        });

        // Jogador
        ctx.fillStyle = '#1f3c88';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        ctx.fillStyle = '#f5f7ff';
        ctx.fillRect(player.x + 3, player.y + 3, player.width - 6, 6);

        // Objetivo com cor e emoji da fase
        ctx.fillStyle = level.goalColor;
        ctx.fillRect(goal.x, goal.y, goal.size, goal.size);
        
        // Borda do objetivo
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(goal.x, goal.y, goal.size, goal.size);

        ctx.fillStyle = '#333';
        ctx.font = '14px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(level.goalEmoji, goal.x + goal.size / 2, goal.y + goal.size - 2);
        ctx.textAlign = 'left';
    }

    function loop() {
        if (!isGameActive) {
            stopGameLoop();
            return;
        }
        update();
        draw();
        animationId = requestAnimationFrame(loop);
    }

    function handleKeyDown(e) {
        if (!isGameActive || !player) return;
        
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
            if (player.onGround) {
                player.vy = JUMP_FORCE;
                player.onGround = false;
            }
        }
    }

    function handleKeyUp(e) {
        if (!isGameActive) return;
        
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    }

    function addMobileControl(button, keyName, isJump = false) {
        if (!button) return;
        
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!isGameActive || !player) return;
            
            if (isJump) {
                if (player.onGround) {
                    player.vy = JUMP_FORCE;
                    player.onGround = false;
                }
            } else {
                keys[keyName] = true;
            }
        });

        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!isGameActive) return;
            
            if (!isJump) {
                keys[keyName] = false;
            }
        });
    }

    // Função para iniciar o jogo
    function startGame() {
        stopGameLoop(); // Garantir que não há loop anterior rodando
        currentLevel = 0; // Começar da primeira fase
        if (startScreen) startScreen.classList.add('hidden');
        if (levelCompleteScreen) levelCompleteScreen.classList.add('hidden');
        if (messageScreen) messageScreen.classList.add('hidden');
        if (gameScreen) gameScreen.classList.remove('hidden');
        loadLevel(0);
        isGameActive = true;
        loop();
    }

    // Função para avançar para próxima fase
    function nextLevel() {
        stopGameLoop();
        currentLevel++;
        if (levelCompleteScreen) levelCompleteScreen.classList.add('hidden');
        if (gameScreen) gameScreen.classList.remove('hidden');
        loadLevel(currentLevel);
        isGameActive = true;
        loop();
    }

    // Função para reiniciar o jogo
    function restartGame() {
        stopGameLoop(); // Garantir que não há loop anterior rodando
        currentLevel = 0; // Resetar para primeira fase
        if (messageScreen) messageScreen.classList.add('hidden');
        if (levelCompleteScreen) levelCompleteScreen.classList.add('hidden');
        if (gameScreen) gameScreen.classList.remove('hidden');
        loadLevel(0);
        isGameActive = true;
        loop();
    }

    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', restartGame);
    }

    if (nextLevelBtn) {
        nextLevelBtn.addEventListener('click', nextLevel);
    }

    // Configurar canvas responsivo
    function setupResponsiveCanvas() {
        const container = canvas.parentElement;
        if (!container) return;

        const maxWidth = Math.min(420, container.clientWidth - 40);
        const scale = maxWidth / CANVAS_WIDTH;
        
        canvas.style.width = `${maxWidth}px`;
        canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
    }

    // Event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', setupResponsiveCanvas);

    // Configurar controles mobile
    if (leftBtn) addMobileControl(leftBtn, 'left');
    if (rightBtn) addMobileControl(rightBtn, 'right');
    if (jumpBtn) addMobileControl(jumpBtn, 'up', true);

    // Inicializar canvas responsivo
    setupResponsiveCanvas();
});