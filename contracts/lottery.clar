;; Lottery Contract
;; Allows users to purchase tickets and randomly selects winners

;; Constants
(define-constant contract-owner tx-sender)
(define-constant ticket-price u1000000) ;; 1 STX
(define-constant min-participants u3)
(define-constant commission-rate u50) ;; 5% commission (out of 1000)

;; Error codes
(define-constant err-not-owner (err u100))
(define-constant err-lottery-active (err u101))
(define-constant err-insufficient-funds (err u102))
(define-constant err-lottery-inactive (err u103))
(define-constant err-min-participants-not-met (err u104))

;; Data variables
(define-data-var lottery-active bool false)
(define-data-var current-lottery-id uint u0)
(define-data-var ticket-counter uint u0)
(define-data-var prize-pool uint u0)

;; Data maps
(define-map tickets
    { lottery-id: uint, ticket-id: uint }
    { participant: principal }
)

(define-map participant-tickets
    { lottery-id: uint, participant: principal }
    { ticket-count: uint }
)

;; Read-only functions
(define-read-only (get-ticket-price)
    ticket-price
)

(define-read-only (get-lottery-status)
    (var-get lottery-active)
)

(define-read-only (get-current-lottery-id)
    (var-get current-lottery-id)
)

(define-read-only (get-prize-pool)
    (var-get prize-pool)
)

(define-read-only (get-participant-tickets (participant principal))
    (default-to
        { ticket-count: u0 }
        (map-get? participant-tickets
            { lottery-id: (var-get current-lottery-id),
              participant: participant }
        )
    )
)

;; Private functions
(define-private (random-number (max uint))
    (mod (get-block-info! time (- block-height u1)) max)
)

;; Public functions
(define-public (start-lottery)
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-not-owner)
        (asserts! (not (var-get lottery-active)) err-lottery-active)
        (var-set lottery-active true)
        (var-set current-lottery-id (+ (var-get current-lottery-id) u1))
        (var-set ticket-counter u0)
        (var-set prize-pool u0)
        (ok true)
    )
)

(define-public (buy-ticket (number-of-tickets uint))
    (let (
        (total-cost (* number-of-tickets ticket-price))
        (current-id (var-get current-lottery-id))
        (current-ticket-id (var-get ticket-counter))
    )
        (asserts! (var-get lottery-active) err-lottery-inactive)
        (asserts! (>= (stx-get-balance tx-sender) total-cost) err-insufficient-funds)

        ;; Transfer STX to contract
        (try! (stx-transfer? total-cost tx-sender (as-contract tx-sender)))

        ;; Update prize pool
        (var-set prize-pool (+ (var-get prize-pool) total-cost))

        ;; Record tickets
        (map-set participant-tickets
            { lottery-id: current-id, participant: tx-sender }
            { ticket-count: (+ number-of-tickets
                (get ticket-count (get-participant-tickets tx-sender))) }
        )

        ;; Create individual ticket entries
        (var-set ticket-counter (+ current-ticket-id number-of-tickets))
        (ok true)
    )
)

(define-public (draw-winner)
    (let (
        (total-tickets (var-get ticket-counter))
        (total-prize (var-get prize-pool))
        (commission (/ (* total-prize commission-rate) u1000))
        (winner-prize (- total-prize commission))
    )
        (asserts! (is-eq tx-sender contract-owner) err-not-owner)
        (asserts! (var-get lottery-active) err-lottery-inactive)
        (asserts! (>= total-tickets min-participants) err-min-participants-not-met)

        ;; Select winning ticket
        (let (
            (winning-ticket-id (random-number total-tickets))
            (winner-info (unwrap!
                (map-get? tickets
                    { lottery-id: (var-get current-lottery-id),
                      ticket-id: winning-ticket-id }
                )
                err-lottery-inactive))
        )
            ;; Transfer prize to winner
            (try! (as-contract
                (stx-transfer? winner-prize
                    tx-sender
                    (get participant winner-info))))

            ;; Transfer commission to contract owner
            (try! (as-contract
                (stx-transfer? commission
                    tx-sender
                    contract-owner)))

            ;; End lottery
            (var-set lottery-active false)
            (ok { winner: (get participant winner-info),
                 prize: winner-prize })
        )
    )
)

