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
