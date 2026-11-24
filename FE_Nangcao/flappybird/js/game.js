// Flappy Bird – jQuery (hoàn thiện theo hướng dẫn, có Level và phím mũi tên xuống)
$(function () {
    var $game = $('#game'), $bird = $('#bird'), $score = $('#score'), $level = $('#level');
    var GAME_W = 480, GAME_H = 640, GROUND = 560;
    var BIRD_X = 90, BIRD_W = 68, BIRD_H = 48, HIT = 8;      // HIT: thu nhỏ vùng va chạm cho dễ chơi
    var PIPE_W = 80, GAP = 175, PIPE_SPACING = 260;
    var GRAVITY = 0.42, FLAP = -7.2, MAX_FALL = 9, PIPE_SPEED = 3;

    // Level: điểm bắt đầu và interval (ms) của vòng lặp game
    var LEVELS = [
        {level: 1, from: 0,  interval: 40},
        {level: 2, from: 5,  interval: 30},
        {level: 3, from: 20, interval: 25},
        {level: 4, from: 40, interval: 20}
    ];
    var WIN_SCORE = 50;

    var state = {}, timer = null, best = parseInt(localStorage.getItem('fb_best') || '0', 10);
    $('#best').text('Best: ' + best);
    window.game = state; // để quan sát trạng thái khi kiểm thử

    function levelOf(score) {
        var l = LEVELS[0];
        $.each(LEVELS, function (i, x) { if (score >= x.from) l = x; });
        return l;
    }

    function newPipe(x) {
        var gapTop = 70 + Math.random() * (GROUND - GAP - 140);
        var $top = $('<div class="pipe top"></div>').css({height: gapTop, top: 0});
        var $bot = $('<div class="pipe bottom"></div>').css({top: gapTop + GAP, height: GROUND - gapTop - GAP});
        $game.append($top, $bot);
        return {x: x, gapTop: gapTop, $top: $top, $bot: $bot, passed: false};
    }

    function reset() {
        $('.pipe').remove();
        state.y = 250; state.v = 0; state.score = 0; state.running = false; state.paused = false;
        state.pipes = [newPipe(GAME_W + 40), newPipe(GAME_W + 40 + PIPE_SPACING)];
        state.lv = LEVELS[0];
        $score.text(0); $level.text('Level 1');
        render();
    }

    function render() {
        var angle = Math.max(-25, Math.min(70, state.v * 6));
        $bird.css('transform', 'translate3d(0,' + state.y + 'px,0) rotate(' + angle + 'deg)');
        $.each(state.pipes, function (i, p) {
            p.$top.css('transform', 'translate3d(' + p.x + 'px,0,0)');
            p.$bot.css('transform', 'translate3d(' + p.x + 'px,0,0)');
        });
    }

    function collide(p) {
        var l = BIRD_X + HIT, r = BIRD_X + BIRD_W - HIT, t = state.y + HIT, b = state.y + BIRD_H - HIT;
        if (r < p.x || l > p.x + PIPE_W) return false;
        return t < p.gapTop || b > p.gapTop + GAP;
    }

    function setLoop(interval) {
        clearInterval(timer);
        timer = setInterval(tick, interval);
    }

    function toast(text) {
        $('#toast').stop(true, true).text(text).fadeIn(150).delay(900).fadeOut(300);
    }

    function tick() {
        state.v = Math.min(MAX_FALL, state.v + GRAVITY);
        state.y += state.v;
        $.each(state.pipes, function (i, p) {
            p.x -= PIPE_SPEED;
            if (!p.passed && p.x + PIPE_W < BIRD_X) {
                p.passed = true;
                state.score++;
                $score.text(state.score);
                var lv = levelOf(state.score);
                if (lv.level !== state.lv.level) {           // lên level: đổi interval
                    state.lv = lv;
                    $level.text('Level ' + lv.level);
                    toast('LEVEL ' + lv.level + '!');
                    setLoop(lv.interval);
                }
            }
        });
        if (state.pipes[0].x + PIPE_W < -20) {                // ống ra khỏi màn hình → tạo ống mới
            var old = state.pipes.shift();
            old.$top.remove(); old.$bot.remove();
            state.pipes.push(newPipe(state.pipes[state.pipes.length - 1].x + PIPE_SPACING));
        }
        if (state.score >= WIN_SCORE) { return finish(true); }
        if (state.y < -10 || state.y + BIRD_H > GROUND || collide(state.pipes[0]) || collide(state.pipes[1])) {
            return finish(false);
        }
        render();
    }

    function finish(win) {
        clearInterval(timer); timer = null; state.running = false;
        render();
        if (state.score > best) { best = state.score; localStorage.setItem('fb_best', best); $('#best').text('Best: ' + best); }
        $('#panel h1').text(win ? 'CHIẾN THẮNG!' : 'Game Over');
        $('#panel-msg').html(win ? 'Bạn đạt <b>' + WIN_SCORE + ' điểm</b> và vượt qua Level 4 🎉' : 'Điểm: <b>' + state.score + '</b> – Level ' + state.lv.level);
        $('#start').text('Chơi lại');
        $('#panel').addClass('show');
        state.result = win ? 'win' : 'lose';
    }

    function start() {
        reset();
        $('#panel').removeClass('show');
        state.running = true; state.result = null;
        state.v = FLAP;
        setLoop(LEVELS[0].interval);
    }

    // Thay sự kiện mousedown bằng keydown: Arrow Down để bay lên
    $(document).on('keydown', function (e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.running && !state.paused && !e.originalEvent.repeat) state.v = FLAP;
        } else if (e.key === ' ' && !state.running) {
            e.preventDefault(); start();
        } else if ((e.key === 'p' || e.key === 'P') && state.running) {
            state.paused = !state.paused;
            if (state.paused) { clearInterval(timer); toast('TẠM DỪNG'); } else setLoop(state.lv.interval);
        }
    });
    $('#start').on('click', start);
    reset();
});
