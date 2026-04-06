-- English weekly learning-path seed
-- Created on 2026-04-02
-- Note:
-- 1. Existing published missions were reused first.
-- 2. Grades 7-9 do not yet have enough easy missions in the current corpus.
--    Those paths are seeded with the closest available progression so the UI is not empty.
-- 3. Recommended follow-up: backfill easier bridge missions for grades 7-9.

delete from learning_path_recommendations
where path_key in (
  'english_elem4_school_weekly_path_v1',
  'english_elem5_food_weekly_path_v1',
  'english_elem6_digital_weekly_path_v1',
  'english_mid1_careers_weekly_path_v1',
  'english_mid2_collab_weekly_path_v1',
  'english_mid3_social_weekly_path_v1'
);

insert into learning_path_recommendations (
  path_key,
  subject,
  school_level,
  grade,
  unit_id,
  mission_id,
  weekday_label,
  step_order,
  difficulty,
  reward_xp,
  is_active
)
values
  -- Grade 4: full easy -> easy -> normal -> normal -> hard path
  ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, '2a96800f-249f-4598-9570-97e5487504a7', '93a5e546-bf63-4772-a8c3-c9862bd9e75b', '월', 1, 'easy', 10, true),
  ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, '2a96800f-249f-4598-9570-97e5487504a7', '89b17d2b-7b93-4321-8c8e-11687173dfd4', '화', 2, 'easy', 12, true),
  ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, '2a96800f-249f-4598-9570-97e5487504a7', '74590788-4528-42be-990b-17acc8c382df', '수', 3, 'normal', 18, true),
  ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, '2a96800f-249f-4598-9570-97e5487504a7', '65b45db9-84b0-4e82-b7d6-a265847705c0', '목', 4, 'normal', 22, true),
  ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, '2a96800f-249f-4598-9570-97e5487504a7', '003c84db-b9b5-4cfd-8bc1-e6fe78a6f1e5', '금', 5, 'hard', 30, true),

  -- Grade 5: closest available progression from current food-ordering corpus
  ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'bcddf782-61e2-4226-b79e-c94ae4386c70', 'bf2ae45c-7638-4c03-ac09-897ba189233f', '월', 1, 'easy', 10, true),
  ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'bcddf782-61e2-4226-b79e-c94ae4386c70', 'c119da26-6cb7-4ce7-8d31-5ce8e4f5ece4', '화', 2, 'normal', 12, true),
  ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'bcddf782-61e2-4226-b79e-c94ae4386c70', '4d883ed3-cd34-4b87-ae32-1f7850df275b', '수', 3, 'normal', 18, true),
  ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'bcddf782-61e2-4226-b79e-c94ae4386c70', 'd2f0e04f-c266-4f30-91e7-0e4559c40877', '목', 4, 'normal', 22, true),
  ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'bcddf782-61e2-4226-b79e-c94ae4386c70', 'c0fba79c-5c04-4614-b38a-d460081d4cd5', '금', 5, 'hard', 30, true),

  -- Grade 6: reading scaffold into digital safety
  ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'b2222222-2222-4222-8222-222222222222', '2b800002-2222-4222-8222-222222222222', '월', 1, 'easy', 10, true),
  ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'b2222222-2222-4222-8222-222222222222', 'a8b00008-8888-4888-8888-888888888888', '화', 2, 'easy', 12, true),
  ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'f9ba5ec5-ff4f-42e6-b189-49684f5b3760', 'd3c505f0-8d6a-43de-bb91-e30b56eb61d1', '수', 3, 'normal', 18, true),
  ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'f9ba5ec5-ff4f-42e6-b189-49684f5b3760', '770fc1aa-361b-4d18-b564-da203c2607e6', '목', 4, 'hard', 22, true),
  ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'f9ba5ec5-ff4f-42e6-b189-49684f5b3760', '10de5d4c-1967-44a0-91ea-c32d03d00d30', '금', 5, 'hard', 30, true),

  -- Grade 7: closest available bridge from opinion reading into careers
  ('english_mid1_careers_weekly_path_v1', 'english', 'middle', 7, 'c3333333-3333-4333-8333-333333333333', '9c4b9f32-4f42-4edd-acf9-3300c3fa0003', '월', 1, 'normal', 10, true),
  ('english_mid1_careers_weekly_path_v1', 'english', 'middle', 7, 'c3333333-3333-4333-8333-333333333333', '58d98673-7f30-4101-b9ac-6aab0fc3779b', '화', 2, 'normal', 12, true),
  ('english_mid1_careers_weekly_path_v1', 'english', 'middle', 7, '6d2ef9c0-71f4-46a4-a831-d10bb7f4d55e', 'c39e4303-9a7c-4f11-969e-01da9c8a8590', '수', 3, 'normal', 18, true),
  ('english_mid1_careers_weekly_path_v1', 'english', 'middle', 7, '6d2ef9c0-71f4-46a4-a831-d10bb7f4d55e', 'c1c38712-cb14-4c84-95ee-55bcdfab9390', '목', 4, 'hard', 22, true),
  ('english_mid1_careers_weekly_path_v1', 'english', 'middle', 7, '6d2ef9c0-71f4-46a4-a831-d10bb7f4d55e', '3fa1f33e-818c-4492-b2a5-601b76fd5c1c', '금', 5, 'hard', 30, true),

  -- Grade 8: advice scaffold into collaboration problem solving
  ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, 'b7d1e063-b47d-4186-8094-ac135f4ef110', 'd9ed2133-393f-4b81-b3a7-2469a2892d94', '월', 1, 'normal', 10, true),
  ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, 'b7d1e063-b47d-4186-8094-ac135f4ef110', '8634909d-b761-4d53-86ad-dbdc6866a76d', '화', 2, 'normal', 12, true),
  ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, 'b7d1e063-b47d-4186-8094-ac135f4ef110', '4fe9f9b9-15ea-4f0e-b48f-bf06eac564a8', '수', 3, 'normal', 18, true),
  ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, '774096ff-b87c-451c-aeb7-19dab423df32', 'f75c650b-edd0-4c44-b91c-715c3f549db2', '목', 4, 'hard', 22, true),
  ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, '774096ff-b87c-451c-aeb7-19dab423df32', '95f73067-f4f3-4049-9f37-0e6340669363', '금', 5, 'hard', 30, true),

  -- Grade 9: current corpus is hard-only, so this path keeps students out of an empty state
  ('english_mid3_social_weekly_path_v1', 'english', 'middle', 9, '2b68c59c-e300-4c88-a4d9-755f484787ab', '472a67b4-7234-448c-9572-d75a4de56720', '월', 1, 'hard', 10, true),
  ('english_mid3_social_weekly_path_v1', 'english', 'middle', 9, '2b68c59c-e300-4c88-a4d9-755f484787ab', '128e2eff-a3fc-4a2d-b3bb-8bd5d5514005', '화', 2, 'hard', 12, true),
  ('english_mid3_social_weekly_path_v1', 'english', 'middle', 9, '2b68c59c-e300-4c88-a4d9-755f484787ab', 'de5ab8db-3af7-41eb-b569-51bf4648f272', '수', 3, 'hard', 18, true),
  ('english_mid3_social_weekly_path_v1', 'english', 'middle', 9, '2b68c59c-e300-4c88-a4d9-755f484787ab', 'eaf0b6bf-1f34-43f5-930f-e1ea7b772b8e', '목', 4, 'hard', 22, true),
  ('english_mid3_social_weekly_path_v1', 'english', 'middle', 9, '2b68c59c-e300-4c88-a4d9-755f484787ab', '13d618f0-e862-4497-a8ba-90fb7a275414', '금', 5, 'hard', 30, true);
